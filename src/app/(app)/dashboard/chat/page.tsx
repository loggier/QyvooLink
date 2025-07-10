
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { 
  doc, getDoc, 
  collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, Timestamp as FirestoreTimestamp,
  setDoc, onSnapshot, limit
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EvolveLinkLogo } from '@/components/icons';
import { Loader2, MessageCircle, AlertTriangle, Info, User, Send, Save, Building, Mail, Phone, UserCheck, Bot, UserRound, MessageSquareDashed, Zap, ArrowLeft, ListTodo, UserCog, Filter, StickyNote } from 'lucide-react'; 
import type { WhatsAppInstance } from '../configuration/page'; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; 
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ContactDetailsPanel, { type ContactDetails } from '@/components/dashboard/chat/contact-details-panel'; 
import { format, isToday, isYesterday, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamMember } from '../team/page';
import { sendAssignmentNotificationEmail } from '@/lib/email';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessageDocument {
  chat_id: string;
  from: string;
  instance: string;
  instanceId: string;
  mensaje: string;
  timestamp: FirestoreTimestamp; 
  to: string;
  user_name: 'User' | 'bot' | string; // 'agente' is now a generic string
  author?: {
    uid: string;
    name: string;
  };
  type?: 'message' | 'internal_note';
}

interface ChatMessage extends ChatMessageDocument {
  id: string; 
}

interface ConversationSummary {
  chat_id: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSender: string;
  lastMessageAuthorName?: string;
  nameLine1: string;
  nameLine2: string | null;
  avatarFallback?: string; 
  status?: ContactDetails['estadoConversacion'];
  assignedTo?: string; // Add assignedTo for filtering
  assignedToName?: string;
}

interface QuickReply {
  id: string;
  userId: string;
  tag: string;
  message: string;
}

const getContactDocId = (userId: string, chatId: string): string => `${userId}_${chatId.replace(/@/g, '_')}`;

function formatWhatsAppMessage(text: string | undefined | null): React.ReactNode[] {
  if (typeof text !== 'string' || !text) {
    return [text]; 
  }

  const elements: React.ReactNode[] = [];
  const regex = /(```(?:.|\n)*?```)|(\*(.+?)\*)|(_([^_]+?)_)|(~([^~]+?)~)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      elements.push(text.substring(lastIndex, startIndex));
    }

    if (match[1]) { 
      elements.push(<code key={lastIndex} className="font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded text-xs">{match[1].slice(3, -3)}</code>);
    } else if (match[2]) { 
      elements.push(<strong key={lastIndex}>{match[3]}</strong>);
    } else if (match[4]) { 
      elements.push(<em key={lastIndex}>{match[5]}</em>);
    } else if (match[6]) { 
      elements.push(<del key={lastIndex}>{match[7]}</del>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  if (elements.length === 0 && text.length > 0) {
      elements.push(text);
  }

  return elements;
}

const formatTimestamp = (timestampInput: FirestoreTimestamp | Date | undefined): string => {
    if (!timestampInput) return "";
    const date = timestampInput instanceof FirestoreTimestamp ? timestampInput.toDate() : (typeof timestampInput === 'string' ? parseISO(timestampInput) : timestampInput);
    return format(date, 'HH:mm', { locale: es });
};

const formatConversationTimestamp = (timestamp: Date | undefined): string => {
    if (!timestamp) return 'No time';
    if (isToday(timestamp)) {
      return format(timestamp, 'HH:mm', { locale: es });
    }
    if (isYesterday(timestamp)) {
      return 'Ayer';
    }
    if (differenceInCalendarDays(new Date(), timestamp) < 7) {
        return format(timestamp, 'EEEE', { locale: es });
    }
    return format(timestamp, 'dd/MM/yy', { locale: es });
};

// Main Component
export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const [contactDetails, setContactDetails] = useState<ContactDetails | null>(null);
  const [initialContactDetails, setInitialContactDetails] = useState<ContactDetails | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isLoadingContact, setIsLoadingContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [internalNoteMessage, setInternalNoteMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const dataFetchUserId = user?.role === 'agent' ? user?.ownerId : user?.uid;


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Fetch WhatsApp Instance
  const fetchWhatsAppInstance = useCallback(async () => {
    if (!dataFetchUserId) return;
    try {
      const instanceDocRef = doc(db, 'instances', dataFetchUserId);
      const instanceDocSnap = await getDoc(instanceDocRef);
      if (instanceDocSnap.exists()) {
        setWhatsAppInstance(instanceDocSnap.data() as WhatsAppInstance);
      } else {
        toast({ variant: "destructive", title: "Configuración Requerida", description: "No se encontró una instancia de WhatsApp. Por favor, configúrala.", duration: 5000 });
      }
    } catch (error) {
      console.error("Error fetching WhatsApp instance:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la instancia de WhatsApp." });
    }
  }, [dataFetchUserId, toast]);

  // Fetch Team Members
  const fetchTeamMembers = useCallback(async () => {
    if (!user?.organizationId) return;
    try {
      const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      const members: TeamMember[] = [];
      querySnapshot.forEach(doc => {
          const data = doc.data();
          members.push({ uid: doc.id, fullName: data.fullName, email: data.email, role: data.role, isActive: data.isActive });
      });
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }, [user?.organizationId]);

  // Fetch Quick Replies
  const fetchQuickReplies = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'quickReplies'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const replies: QuickReply[] = [];
      querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() } as QuickReply));
      setQuickReplies(replies);
    } catch (error) {
      console.error('Error fetching quick replies:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchWhatsAppInstance();
    fetchTeamMembers();
    fetchQuickReplies();
  }, [fetchWhatsAppInstance, fetchTeamMembers, fetchQuickReplies]);

  // Fetch and summarize conversations
  const fetchConversations = useCallback(async () => {
    if (!whatsAppInstance || !dataFetchUserId) return;
    setIsLoadingConversations(true);

    try {
      const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
      const q = query(
        collection(db, 'chat'),
        where('instanceId', '==', instanceIdentifier),
        orderBy('timestamp', 'desc'),
        limit(500)
      );

      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const messagesByChatId = new Map<string, ChatMessageDocument>();
        querySnapshot.forEach(doc => {
          const msg = doc.data() as ChatMessageDocument;
          // Robustly get the external chat ID
          let chatId = msg.chat_id;
          if (!chatId.endsWith('@g.us')) { // Not a group chat
             if (msg.user_name?.toLowerCase() === 'user' || msg.from.includes('@c.us')) {
                chatId = msg.from;
             } else if (msg.to.includes('@c.us')) {
                chatId = msg.to;
             }
          }
          if (!messagesByChatId.has(chatId)) {
            messagesByChatId.set(chatId, msg);
          }
        });

        const contactDetailsPromises = Array.from(messagesByChatId.keys()).map(async chatId => {
          const contactDocId = getContactDocId(dataFetchUserId, chatId);
          const contactDocRef = doc(db, 'contacts', contactDocId);
          const contactDocSnap = await getDoc(contactDocRef);
          return contactDocSnap.exists() ? { chatId, data: contactDocSnap.data() as ContactDetails } : { chatId, data: null };
        });

        const contactDetailsResults = await Promise.all(contactDetailsPromises);
        const contactsMap = new Map(contactDetailsResults.map(r => [r.chatId, r.data]));
        
        const conversationSummaries = Array.from(messagesByChatId.entries()).map(([chatId, msg]) => {
            const contactData = contactsMap.get(chatId);

            const name = (contactData?.nombre && contactData?.apellido) ? `${contactData.nombre} ${contactData.apellido}` : contactData?.nombre || formatPhoneNumber(chatId);
            const subName = contactData?.empresa || (name !== formatPhoneNumber(chatId) ? formatPhoneNumber(chatId) : null);
            const avatarFallback = (contactData?.nombre ? contactData.nombre[0] : '') + (contactData?.apellido ? contactData.apellido[0] : '');

            return {
              chat_id: chatId,
              lastMessage: msg.mensaje,
              lastMessageTimestamp: msg.timestamp.toDate(),
              lastMessageSender: msg.user_name,
              lastMessageAuthorName: msg.author?.name,
              nameLine1: name,
              nameLine2: subName,
              avatarFallback: avatarFallback || formatPhoneNumber(chatId).slice(-2),
              status: contactData?.estadoConversacion || 'Abierto',
              assignedTo: contactData?.assignedTo,
              assignedToName: teamMembers.find(m => m.uid === contactData?.assignedTo)?.fullName,
            };
        });

        setConversations(conversationSummaries);
        setIsLoadingConversations(false);
      }, (error) => {
        console.error("Error fetching conversations in real-time:", error);
        toast({ variant: "destructive", title: "Error de Sincronización", description: "No se pudieron cargar las conversaciones." });
        setIsLoadingConversations(false);
      });

      return unsubscribe;

    } catch (error) {
      console.error("Error setting up conversation listener:", error);
      setIsLoadingConversations(false);
    }
  }, [whatsAppInstance, dataFetchUserId, toast, teamMembers]);
  
  useEffect(() => {
    const unsubscribePromise = fetchConversations();
    return () => {
      unsubscribePromise?.then(unsubscribe => unsubscribe?.());
    };
  }, [fetchConversations]);

  // Apply filters
  useEffect(() => {
    if (!user) return;
    let filtered = conversations;
    if (filter === 'mine') {
      filtered = conversations.filter(c => c.assignedTo === user.uid);
    } else if (filter === 'unassigned') {
      filtered = conversations.filter(c => !c.assignedTo);
    }
    setFilteredConversations(filtered);
  }, [conversations, filter, user]);

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setIsEditingContact(false); // Reset editing state on chat change
    // Update URL without reloading page
    router.push(`/dashboard/chat?chatId=${chatId}`, { scroll: false });
  }, [router]);

  // Effect to handle initial chat selection from URL
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && conversations.length > 0) {
      if (conversations.some(c => c.chat_id === chatIdFromUrl)) {
        setSelectedChatId(chatIdFromUrl);
      }
    }
  }, [searchParams, conversations]);

  // Fetch messages for the selected chat
  useEffect(() => {
    if (!selectedChatId || !whatsAppInstance) return;

    setIsLoadingMessages(true);
    const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
    const q = query(
      collection(db, 'chat'),
      where('instanceId', '==', instanceIdentifier),
      where('chat_id', 'in', [selectedChatId, `${selectedChatId.split('@')[0]}@c.us`]),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
      });
      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los mensajes." });
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedChatId, whatsAppInstance, toast]);

  // Fetch contact details for the selected chat
  useEffect(() => {
    if (!selectedChatId || !dataFetchUserId) {
      setContactDetails(null);
      setInitialContactDetails(null);
      return;
    }

    setIsLoadingContact(true);
    const contactDocId = getContactDocId(dataFetchUserId, selectedChatId);
    const contactDocRef = doc(db, 'contacts', contactDocId);

    const unsubscribe = onSnapshot(contactDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ContactDetails;
        setContactDetails(data);
        setInitialContactDetails(data);
      } else {
        const newContact: ContactDetails = {
          id: contactDocId,
          _chatIdOriginal: selectedChatId,
          telefono: formatPhoneNumber(selectedChatId),
          userId: dataFetchUserId,
          estadoConversacion: 'Abierto',
          chatbotEnabledForContact: true,
          assignedTo: '',
        };
        setContactDetails(newContact);
        setInitialContactDetails(newContact);
      }
      setIsLoadingContact(false);
    }, (error) => {
      console.error("Error fetching contact details:", error);
      setIsLoadingContact(false);
    });

    return () => unsubscribe();
  }, [selectedChatId, dataFetchUserId]);

  const handleSaveContactDetails = async () => {
    if (!contactDetails || !dataFetchUserId) return;

    // Ensure we have a valid document ID before saving.
    const contactDocId = contactDetails.id || getContactDocId(dataFetchUserId, contactDetails._chatIdOriginal!);
     if (!contactDocId) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo determinar el ID del contacto para guardar." });
      return;
    }

    setIsSavingContact(true);
    try {
      const contactDocRef = doc(db, 'contacts', contactDocId);
      await setDoc(contactDocRef, contactDetails, { merge: true });
      toast({ title: "Contacto Actualizado", description: "La información del contacto ha sido guardada." });
      setIsEditingContact(false);
      
      // If assignee changed, send email
      if (initialContactDetails?.assignedTo !== contactDetails.assignedTo && contactDetails.assignedTo) {
          const assignee = teamMembers.find(m => m.uid === contactDetails.assignedTo);
          if (assignee && user && assignee.email) {
              await sendAssignmentNotificationEmail({
                  assigneeEmail: assignee.email,
                  assigneeName: assignee.fullName,
                  assignerName: user.fullName || user.email || 'Un administrador',
                  contactName: contactDetails.nombre || formatPhoneNumber(contactDetails._chatIdOriginal),
                  chatLink: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/chat?chatId=${selectedChatId}`,
              });
               toast({ title: "Notificación Enviada", description: `Se ha notificado a ${assignee.fullName} sobre la asignación.`});
          }
      }

    } catch (error) {
      console.error("Error saving contact details:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la información del contacto." });
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleCancelEditContact = () => {
    setContactDetails(initialContactDetails);
    setIsEditingContact(false);
  };
  
  const handleInputChange = (field: keyof Omit<ContactDetails, 'id' | 'instanceId' | 'userId' | 'tipoCliente' | '_chatIdOriginal' | 'chatbotEnabledForContact' | 'estadoConversacion'| 'assignedTo' | 'assignedToName'>, value: string) => {
    setContactDetails(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleSelectChange = (value: ContactDetails['tipoCliente']) => {
    setContactDetails(prev => prev ? { ...prev, tipoCliente: value } : null);
  };

  const handleStatusChange = (value: ContactDetails['estadoConversacion']) => {
    setContactDetails(prev => prev ? { ...prev, estadoConversacion: value } : null);
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setContactDetails(prev => prev ? { ...prev, chatbotEnabledForContact: checked } : null);
  };

  const handleAssigneeChange = (memberId: string) => {
      const member = teamMembers.find(m => m.uid === memberId);
      setContactDetails(prev => prev ? {
          ...prev,
          assignedTo: memberId,
          assignedToName: member?.fullName,
      } : null);
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !isInternalNote) || (!internalNoteMessage.trim() && isInternalNote) || !selectedChatId || !whatsAppInstance || !user) return;
    
    const messageContent = isInternalNote ? internalNoteMessage : newMessage;
    const messageType = isInternalNote ? 'internal_note' : 'message';

    setIsSendingMessage(true);
    
    try {
        const messageData = {
            chat_id: selectedChatId,
            from: 'agente',
            to: selectedChatId,
            instance: whatsAppInstance.name,
            instanceId: whatsAppInstance.id || whatsAppInstance.name,
            mensaje: messageContent,
            timestamp: serverTimestamp(),
            user_name: user.role === 'agent' ? 'agente' : 'administrador',
            author: {
                uid: user.uid,
                name: user.fullName || user.email,
            },
            type: messageType,
        };

        // Add message to Firestore 'chat' collection
        await addDoc(collection(db, 'chat'), messageData);
        
        if (isInternalNote) {
            setInternalNoteMessage('');
            setIsInternalNote(false);
        } else {
             // If not an internal note, also send via Qyvoo API
            const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
            const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
            const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;

            let baseWebhookUrl: string | undefined;
            if (useTestWebhook) {
                baseWebhookUrl = testWebhookBase;
            } else {
                baseWebhookUrl = prodWebhookBase;
            }
            if (!baseWebhookUrl) {
                throw new Error("La URL del webhook no está configurada.");
            }
            const webhookUrl = `${baseWebhookUrl}?action=send_message`;
            
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceName: whatsAppInstance.name,
                    number: selectedChatId,
                    message: newMessage,
                }),
            });
            setNewMessage('');
        }

    } catch (error) {
        console.error("Error sending message:", error);
        toast({ variant: 'destructive', title: 'Error de Envío', description: 'No se pudo enviar el mensaje.' });
    } finally {
        setIsSendingMessage(false);
    }
  };

  const handleQuickReplySelect = (message: string) => {
      setNewMessage(prev => prev ? `${prev} ${message}`.trim() : message);
  };
  
  const formatPhoneNumber = (chat_id: string | undefined): string => {
    if (!chat_id) return "Desconocido";
    return chat_id.split('@')[0];
  };

  const getChatName = (chatId: string) => {
      const convo = conversations.find(c => c.chat_id === chatId);
      return convo ? convo.nameLine1 : formatPhoneNumber(chatId);
  }

  // Mobile view logic
  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-8rem)]">
        {selectedChatId ? (
           <div className="flex flex-col w-full h-full">
            <header className="flex items-center p-3 border-b bg-background">
                <Button variant="ghost" size="icon" onClick={() => setSelectedChatId(null)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="ml-3">
                   <h2 className="font-semibold text-lg">{getChatName(selectedChatId)}</h2>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                 {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : (
                  messages.map(msg => <ChatMessageComponent key={msg.id} msg={msg} />)
                )}
                <div ref={messagesEndRef} />
            </main>
             <MessageInputArea
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                isSendingMessage={isSendingMessage}
                handleSendMessage={handleSendMessage}
                quickReplies={quickReplies}
                onQuickReplySelect={handleQuickReplySelect}
                isInternalNote={isInternalNote}
                setIsInternalNote={setIsInternalNote}
                internalNoteMessage={internalNoteMessage}
                setInternalNoteMessage={setInternalNoteMessage}
                userRole={user?.role}
             />
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            isLoading={isLoadingConversations}
          />
        )}
      </div>
    );
  }
  
  // Desktop view
  return (
    <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] lg:grid-cols-[350px_1fr_350px] h-[calc(100vh-8rem)] border rounded-lg bg-card overflow-hidden">
      {/* Conversation List */}
      <div className="flex flex-col border-r">
          <div className="p-4 border-b">
             <h1 className="text-xl font-bold">Conversaciones</h1>
             <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'mine' | 'unassigned')} className="mt-2">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="mine">Míos</TabsTrigger>
                    <TabsTrigger value="unassigned">Sin Asignar</TabsTrigger>
                </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {isLoadingConversations ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <MessageSquareDashed className="h-12 w-12 text-muted-foreground mb-2"/>
                    <p className="text-muted-foreground">No hay conversaciones en esta vista.</p>
                </div>
            ) : (
               <ConversationList
                  conversations={filteredConversations}
                  selectedChatId={selectedChatId}
                  onSelectChat={handleSelectChat}
                  isLoading={false}
              />
            )}
          </ScrollArea>
      </div>

      {/* Chat Panel */}
      <div className="flex flex-col">
        {selectedChatId ? (
          <>
            <header className="flex items-center p-4 border-b bg-background">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>{conversations.find(c => c.chat_id === selectedChatId)?.avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="ml-4">
                    <h2 className="font-semibold text-lg">{conversations.find(c => c.chat_id === selectedChatId)?.nameLine1}</h2>
                    <p className="text-sm text-muted-foreground">{conversations.find(c => c.chat_id === selectedChatId)?.nameLine2}</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <MessageCircle className="h-12 w-12 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Esta es una nueva conversación.</p>
                        <p className="text-sm text-muted-foreground">Envía un mensaje para comenzar.</p>
                    </div>
                ) : (
                  messages.map(msg => <ChatMessageComponent key={msg.id} msg={msg} />)
                )}
                <div ref={messagesEndRef} />
            </main>
            <MessageInputArea
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                isSendingMessage={isSendingMessage}
                handleSendMessage={handleSendMessage}
                quickReplies={quickReplies}
                onQuickReplySelect={handleQuickReplySelect}
                isInternalNote={isInternalNote}
                setIsInternalNote={setIsInternalNote}
                internalNoteMessage={internalNoteMessage}
                setInternalNoteMessage={setInternalNoteMessage}
                userRole={user?.role}
            />
          </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full bg-muted/20">
                <EvolveLinkLogo className="h-20 w-auto opacity-10" data-ai-hint="logo company" />
                <p className="mt-4 text-lg text-muted-foreground">Selecciona una conversación para empezar</p>
                <p className="text-sm text-muted-foreground">O inicia una nueva desde la lista de contactos.</p>
            </div>
        )}
      </div>

      {/* Contact Details Panel */}
      <div className="flex flex-col border-l">
        <ContactDetailsPanel
          contactDetails={contactDetails}
          initialContactDetails={initialContactDetails}
          isEditingContact={isEditingContact}
          setIsEditingContact={setIsEditingContact}
          isLoadingContact={isLoadingContact}
          isSavingContact={isSavingContact}
          teamMembers={teamMembers}
          onSave={handleSaveContactDetails}
          onCancel={handleCancelEditContact}
          onInputChange={handleInputChange}
          onSelectChange={handleSelectChange}
          onStatusChange={handleStatusChange}
          onSwitchChange={handleSwitchChange}
          onAssigneeChange={handleAssigneeChange}
          formatPhoneNumber={formatPhoneNumber}
        />
      </div>
    </div>
  );
}


// --- Sub-components --- //

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isLoading: boolean;
}

function ConversationList({ conversations, selectedChatId, onSelectChat, isLoading }: ConversationListProps) {
  if (isLoading) {
      return (
          <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                      </div>
                  </div>
              ))}
          </div>
      );
  }

  return (
    <nav className="p-2 space-y-1">
      {conversations.map((convo) => (
        <button
          key={convo.chat_id}
          onClick={() => onSelectChat(convo.chat_id)}
          className={`w-full text-left p-3 rounded-lg flex items-start space-x-3 transition-colors ${selectedChatId === convo.chat_id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback>{convo.avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-sm truncate">{convo.nameLine1}</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatConversationTimestamp(convo.lastMessageTimestamp)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {convo.lastMessageSender === 'User' ? <span className="font-medium">Tú:</span> : ''}
              {convo.lastMessage}
            </p>
          </div>
        </button>
      ))}
    </nav>
  );
}


function ChatMessageComponent({ msg }: { msg: ChatMessage }) {
    if (msg.type === 'internal_note') {
        return (
            <div key={msg.id} className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-x-0 h-px bg-yellow-300 dark:bg-yellow-700"></div>
                <div className="relative flex items-start gap-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-4 py-2 text-xs text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 shadow-sm">
                    <StickyNote className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="max-w-sm">
                        <p className="font-bold">{msg.author?.name || 'Agente'}</p>
                        <p className="whitespace-pre-wrap">{msg.mensaje}</p>
                        <p className="text-right text-yellow-600 dark:text-yellow-500 mt-1">{formatTimestamp(msg.timestamp)}</p>
                    </div>
                </div>
            </div>
        );
    }
    
    const userNameLower = msg.user_name?.toLowerCase();
    const isExternalUser = userNameLower === 'user';
    const alignmentClass = isExternalUser ? 'justify-start' : 'justify-end';
    const bubbleClass = isExternalUser ? 'bg-background' : 'bg-primary text-primary-foreground';
    const IconComponent = isExternalUser ? UserRound : (userNameLower === 'bot' ? Bot : User);
    const avatarFallbackClass = isExternalUser ? "bg-gray-400 text-white" : (userNameLower === 'bot' ? "bg-blue-500 text-white" : "bg-green-500 text-white");

    return (
        <div className={`flex w-full ${alignmentClass}`}>
            <div className={`flex items-end max-w-[85%] sm:max-w-[75%] gap-2`}>
                {isExternalUser && (
                    <Avatar className="h-8 w-8 self-end mb-1">
                        <AvatarFallback className={avatarFallbackClass}><IconComponent className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                )}
                <div className={`py-2 px-3.5 rounded-2xl shadow-sm ${bubbleClass}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                {msg.author?.name && userNameLower !== 'bot' && !isExternalUser && (
                                    <p className="text-xs font-bold mb-1 opacity-90">{msg.author.name}</p>
                                )}
                                <div className="text-sm break-all whitespace-pre-wrap">
                                    {formatWhatsAppMessage(msg.mensaje)}
                                </div>
                                <p className={`text-xs mt-1.5 opacity-80 ${isExternalUser ? 'text-right' : 'text-left'}`}>
                                    {formatTimestamp(msg.timestamp)}
                                </p>
                            </div>
                        </TooltipTrigger>
                        {msg.author?.name && !isExternalUser && (
                             <TooltipContent>
                                <p>{msg.author.name}</p>
                             </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                </div>
                {!isExternalUser && (
                    <Avatar className="h-8 w-8 self-end mb-1">
                         <AvatarFallback className={avatarFallbackClass}><IconComponent className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                )}
            </div>
        </div>
    );
}

interface MessageInputAreaProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  isSendingMessage: boolean;
  handleSendMessage: () => void;
  quickReplies: QuickReply[];
  onQuickReplySelect: (message: string) => void;
  isInternalNote: boolean;
  setIsInternalNote: (value: boolean) => void;
  internalNoteMessage: string;
  setInternalNoteMessage: (value: string) => void;
  userRole?: 'owner' | 'admin' | 'agent';
}

function MessageInputArea({
    newMessage, setNewMessage, isSendingMessage, handleSendMessage,
    quickReplies, onQuickReplySelect, isInternalNote, setIsInternalNote,
    internalNoteMessage, setInternalNoteMessage, userRole
}: MessageInputAreaProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    
    const messagePlaceholder = userRole === 'agent' ? "Escribe tu mensaje como agente..." : "Escribe tu mensaje como administrador...";

    return (
        <footer className={`p-4 border-t bg-background transition-colors duration-300 ${isInternalNote ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
            {quickReplies.length > 0 && !isInternalNote && (
                <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <div className="flex space-x-2">
                        {quickReplies.map(reply => (
                            <Button key={reply.id} variant="outline" size="sm" onClick={() => onQuickReplySelect(reply.message)}>
                                <Zap className="h-3 w-3 mr-1" />
                                {reply.tag}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            )}
            <div className="relative">
                <Textarea
                    ref={inputRef}
                    value={isInternalNote ? internalNoteMessage : newMessage}
                    onChange={(e) => isInternalNote ? setInternalNoteMessage(e.target.value) : setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isInternalNote ? 'Escribe una nota interna (solo visible para tu equipo)...' : messagePlaceholder}
                    className={`pr-24 transition-colors duration-300 ${isInternalNote ? 'border-yellow-400 focus-visible:ring-yellow-500' : ''}`}
                    rows={1}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                     <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsInternalNote(!isInternalNote)}>
                                <StickyNote className={`h-5 w-5 ${isInternalNote ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isInternalNote ? 'Cambiar a mensaje normal' : 'Añadir nota interna'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button onClick={handleSendMessage} disabled={isSendingMessage}>
                        {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </footer>
    );
}

    

    

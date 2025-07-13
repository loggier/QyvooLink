
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
import { Loader2, MessageCircle, AlertTriangle, Info, User, Send, Save, Building, Mail, Phone, UserCheck, Bot, UserRound, MessageSquareDashed, Zap, ArrowLeft, ListTodo, UserCog, Filter, StickyNote, CalendarClock, PlusCircle } from 'lucide-react'; 
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
import type { Appointment } from '../schedule/page';
import { AppointmentForm } from '@/components/dashboard/schedule/appointment-form';

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

const formatConversationTimestamp = (timestampInput: Date | string | undefined): string => {
  if (!timestampInput) return "";
  const date = typeof timestampInput === 'string' ? parseISO(timestampInput) : timestampInput;
  const now = new Date();

  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: es });
  }
  if (isYesterday(date)) {
    return "Ayer";
  }
  if (differenceInCalendarDays(now, date) < 7) {
    const dayName = format(date, 'EEE', { locale: es });
    return dayName.charAt(0).toUpperCase() + dayName.slice(1) + '.';
  }
  return format(date, 'dd/MM/yy', { locale: es });
};

const formatChatMessageTimestamp = (timestampInput: FirestoreTimestamp | Date | undefined): string => {
  if (!timestampInput) return "";
  const date = timestampInput instanceof FirestoreTimestamp ? timestampInput.toDate() : (typeof timestampInput === 'string' ? parseISO(timestampInput) : timestampInput);

  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: es });
  }
  return format(date, 'dd/MM/yy HH:mm', { locale: es });
};

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const isMobile = useIsMobile();
  const dataFetchUserId = user?.role === 'agent' ? user?.ownerId : user?.uid;

  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null); 
  const [isLoadingInstance, setIsLoadingInstance] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [chatMode, setChatMode] = useState<'message' | 'internal_note'>('message');

  const [contactDetails, setContactDetails] = useState<ContactDetails | null>(null);
  const [initialContactDetails, setInitialContactDetails] = useState<ContactDetails | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isLoadingContact, setIsLoadingContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);

  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoadingQuickReplies, setIsLoadingQuickReplies] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'Abierto' | 'Pendiente' | 'Cerrado'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'mine'>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allContacts, setAllContacts] = useState<ContactDetails[]>([]);

  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mobile layout controls
  const showConversationList = isMobile ? !selectedChatId : true;
  const showChatArea = isMobile ? !!selectedChatId : true;
  const showContactPanelDesktop = !isMobile && selectedChatId && contactDetails && initialContactDetails;

  const formatPhoneNumber = (chat_id: string | undefined): string => {
    if (!chat_id) return "Desconocido";
    return chat_id.split('@')[0];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages]);

  useEffect(() => {
    if (dataFetchUserId) {
      const fetchInstance = async () => {
        setIsLoadingInstance(true);
        setError(null);
        try {
          const instanceDocRef = doc(db, 'instances', dataFetchUserId);
          const instanceDocSnap = await getDoc(instanceDocRef);
          if (instanceDocSnap.exists()) {
            const instanceData = instanceDocSnap.data() as WhatsAppInstance;
            setWhatsAppInstance(instanceData);
            if (instanceData.status !== 'Conectado') {
              setError("Tu instancia de Qyvoo no está conectada. Por favor, ve a Configuración para conectarla.");
            }
          } else {
            setError("No se encontró una instancia de Qyvoo configurada. Por favor, ve a Configuración.");
            setWhatsAppInstance(null);
          }
        } catch (err) {
          console.error("Error fetching WhatsApp instance:", err);
          setError("Error al cargar la configuración de la instancia de Qyvoo.");
        } finally {
          setIsLoadingInstance(false);
        }
      };
      fetchInstance();
    } else {
      setIsLoadingInstance(false);
    }
  }, [dataFetchUserId]);
  
  useEffect(() => {
    if (!user?.organizationId) return;

    const fetchTeamMembers = async () => {
        const teamQuery = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
        const querySnapshot = await getDocs(teamQuery);
        const members: TeamMember[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            members.push({
                uid: doc.id,
                fullName: data.fullName,
                email: data.email,
                role: data.role,
                isActive: data.isActive,
            });
        });
        setTeamMembers(members);
    };
    
    const fetchAllContacts = async () => {
        if (!dataFetchUserId) return;
        const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', dataFetchUserId));
        const contactsSnapshot = await getDocs(contactsQuery);
        const fetchedContacts: ContactDetails[] = [];
        contactsSnapshot.forEach(doc => fetchedContacts.push({ id: doc.id, ...doc.data() } as ContactDetails));
        setAllContacts(fetchedContacts);
    };

    fetchTeamMembers();
    fetchAllContacts();
  }, [user?.organizationId, dataFetchUserId]);

  useEffect(() => {
    if (whatsAppInstance && whatsAppInstance.status === 'Conectado' && (whatsAppInstance.id || whatsAppInstance.name) && dataFetchUserId) {
      const fetchConversations = async () => {
        setIsLoadingChats(true);
        setError(null);
        try {
          const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
          
          const q = query(
            collection(db, 'chat'),
            where('instanceId', '==', instanceIdentifier),
            orderBy('timestamp', 'desc'),
            limit(200)
          );
          
          const querySnapshot = await getDocs(q);
          const messages: ChatMessage[] = [];
          querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
          });
          
          const chatMap = new Map<string, {
              chat_id: string;
              lastMessage: string;
              lastMessageTimestamp: Date;
              lastMessageSender: string;
              lastMessageAuthorName?: string;
          }>();

          messages.forEach(msg => {
            let currentChatId = msg.chat_id; 
             if (msg.from === instanceIdentifier) { 
                currentChatId = msg.to;
            } else if (msg.to === instanceIdentifier) { 
                currentChatId = msg.from;
            }
            if (msg.chat_id.endsWith('@g.us')) { 
                currentChatId = msg.chat_id;
            }

            if (!chatMap.has(currentChatId) || msg.timestamp.toDate() > chatMap.get(currentChatId)!.lastMessageTimestamp) {
              chatMap.set(currentChatId, {
                chat_id: currentChatId,
                lastMessage: msg.mensaje,
                lastMessageTimestamp: msg.timestamp.toDate(),
                lastMessageSender: msg.user_name,
                lastMessageAuthorName: msg.author?.name
              });
            }
          });
          
          const contactPromises = Array.from(chatMap.keys()).map(async (chat_id) => {
            if (!dataFetchUserId) return { chatId: chat_id, data: null };
            // CRITICAL FIX: Add 'where' clause for userId to ensure data isolation.
            const contactQuery = query(
              collection(db, 'contacts'),
              where('userId', '==', dataFetchUserId),
              where('_chatIdOriginal', '==', chat_id),
              limit(1)
            );

            try {
                const contactSnapshot = await getDocs(contactQuery);
                if (!contactSnapshot.empty) {
                    return { chatId: chat_id, data: contactSnapshot.docs[0].data() as ContactDetails };
                }
            } catch (contactError) {
                console.warn(`Error fetching contact for ${chat_id}:`, contactError);
            }
            return { chatId: chat_id, data: null };
          });


          const contactResults = await Promise.all(contactPromises);
          const contactsDataMap = new Map<string, ContactDetails | null>();
          contactResults.forEach(result => {
              if (result) {
                  contactsDataMap.set(result.chatId, result.data);
              }
          });

          const enrichedConversations: ConversationSummary[] = [];
          for (const [chat_id_key, summaryValue] of chatMap.entries()) {
              const contactData = contactsDataMap.get(chat_id_key);
              
              let nameL1 = formatPhoneNumber(chat_id_key);
              let nameL2: string | null = null;
              let avatarFb = nameL1.length >= 2 ? nameL1.slice(0,2).toUpperCase() : nameL1.toUpperCase();

              if (contactData) {
                  const nombreCompleto = [contactData.nombre, contactData.apellido].filter(Boolean).join(' ').trim();
                  const empresa = contactData.empresa?.trim();

                  if (nombreCompleto) {
                      nameL1 = nombreCompleto;
                      if (empresa) {
                          nameL2 = `[${empresa}]`;
                      }
                  } else if (empresa) {
                      nameL1 = empresa;
                  }
                  
                  if (contactData.nombre && contactData.nombre.trim() && contactData.apellido && contactData.apellido.trim()) {
                      avatarFb = `${contactData.nombre.trim()[0]}${contactData.apellido.trim()[0]}`.toUpperCase();
                  } else if (contactData.nombre && contactData.nombre.trim()) {
                       avatarFb = contactData.nombre.trim().substring(0, Math.min(2, contactData.nombre.trim().length)).toUpperCase();
                  } else if (contactData.empresa && contactData.empresa.trim()) {
                       avatarFb = contactData.empresa.trim().substring(0, Math.min(2, contactData.empresa.trim().length)).toUpperCase();
                  }
              }

              enrichedConversations.push({
                  chat_id: chat_id_key,
                  lastMessage: summaryValue.lastMessage,
                  lastMessageTimestamp: summaryValue.lastMessageTimestamp,
                  lastMessageSender: summaryValue.lastMessageSender,
                  lastMessageAuthorName: summaryValue.lastMessageAuthorName,
                  nameLine1: nameL1,
                  nameLine2: nameL2,
                  avatarFallback: avatarFb,
                  status: contactData?.estadoConversacion || 'Abierto',
                  assignedTo: contactData?.assignedTo,
                  assignedToName: contactData?.assignedToName,
              });
          }

          const sortedConversations = enrichedConversations.sort(
            (a,b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime()
          );
          setConversations(sortedConversations);

        } catch (err) {
          console.error("Error fetching conversations:", err);
          setError("Error al cargar las conversaciones de Qyvoo.");
        } finally {
          setIsLoadingChats(false);
        }
      };
      fetchConversations();
    }
  }, [whatsAppInstance, dataFetchUserId]); 

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && !isLoadingChats && conversations.length > 0) {
      const conversationExists = conversations.find(c => c.chat_id === chatIdFromUrl);
      if (conversationExists) {
        if (selectedChatId !== chatIdFromUrl) {
           setSelectedChatId(chatIdFromUrl);
        }
      }
    }
  }, [searchParams, isLoadingChats, conversations, selectedChatId]); 

  useEffect(() => {
    if (selectedChatId && whatsAppInstance) {
      setIsLoadingMessages(true);
      const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
      
      const q = query(
        collection(db, 'chat'),
        where('instanceId', '==', instanceIdentifier),
        where('chat_id', '==', selectedChatId), 
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
        });
        setActiveMessages(messages);
        setIsLoadingMessages(false);
      }, (error) => {
        console.error("Error fetching active messages:", error);
        setError("Error al cargar los mensajes del chat.");
        setIsLoadingMessages(false);
      });

      return () => unsubscribe();
    } else {
      setActiveMessages([]);
    }
  }, [selectedChatId, whatsAppInstance]);

  const fetchContactAndAppointmentDetails = useCallback(async () => {
    if (!selectedChatId || !dataFetchUserId || !whatsAppInstance) return;
     
      setIsLoadingContact(true);
      setNextAppointment(null); // Reset appointment on contact change
      try {
        // CRITICAL FIX: Add 'where' clause for userId to ensure data isolation.
        const contactQuery = query(
          collection(db, 'contacts'),
          where('userId', '==', dataFetchUserId),
          where('_chatIdOriginal', '==', selectedChatId),
          limit(1)
        );
        const contactSnapshot = await getDocs(contactQuery);
        
        let currentContactDetails: ContactDetails;

        if (!contactSnapshot.empty) {
          const contactDoc = contactSnapshot.docs[0];
          const data = { id: contactDoc.id, ...contactDoc.data() } as ContactDetails;
          data.chatbotEnabledForContact = data.chatbotEnabledForContact ?? true;
          data.estadoConversacion = data.estadoConversacion ?? 'Abierto';
          currentContactDetails = data;
          setContactDetails(data);
          setInitialContactDetails(data);
          setIsEditingContact(false);
        } else {
          const initialData: ContactDetails = { 
            id: getContactDocId(dataFetchUserId, selectedChatId), 
            telefono: formatPhoneNumber(selectedChatId),
            nombre: "",
            apellido: "",
            email: "",
            empresa: "",
            ubicacion: "",
            tipoCliente: undefined,
            estadoConversacion: 'Abierto',
            instanceId: whatsAppInstance.id,
            userId: dataFetchUserId, 
            _chatIdOriginal: selectedChatId,
            chatbotEnabledForContact: true, 
            assignedTo: '',
            assignedToName: '',
          };
          currentContactDetails = initialData;
          setContactDetails(initialData); 
          setInitialContactDetails(initialData);
          setIsEditingContact(true);
        }
        
         // Fetch next appointment for this contact
         if (currentContactDetails.id && user?.organizationId) {
           const appointmentQuery = query(
              collection(db, "appointments"),
              where("organizationId", "==", user.organizationId),
              where("contactId", "==", currentContactDetails.id),
              where("start", ">=", FirestoreTimestamp.now()),
              orderBy("start", "asc"),
              limit(1)
           );
           const appointmentSnapshot = await getDocs(appointmentQuery);
           if (!appointmentSnapshot.empty) {
               const apptDoc = appointmentSnapshot.docs[0];
               const apptData = apptDoc.data();
               setNextAppointment({
                   id: apptDoc.id,
                   ...apptData,
                   start: apptData.start.toDate(),
                   end: apptData.end.toDate(),
               } as Appointment);
           }
         }

      } catch (error) {
        console.error("Error fetching contact details:", error);
         toast({ variant: "destructive", title: "Error", description: "Error al cargar detalles del contacto." });
      } finally {
        setIsLoadingContact(false);
      }
  }, [selectedChatId, dataFetchUserId, whatsAppInstance, toast, user?.organizationId]);

  useEffect(() => {
    fetchContactAndAppointmentDetails();
  }, [fetchContactAndAppointmentDetails]);


  const fetchQuickReplies = useCallback(async () => {
    if (!dataFetchUserId) return;
    setIsLoadingQuickReplies(true);
    try {
      const q = query(collection(db, 'quickReplies'), where('userId', '==', dataFetchUserId));
      const querySnapshot = await getDocs(q);
      const fetchedReplies: QuickReply[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedReplies.push({ id: docSnap.id, ...(docSnap.data() as Omit<QuickReply, 'id'|'userId'>) } as QuickReply);
      });
      setQuickReplies(fetchedReplies.sort((a,b) => a.tag.localeCompare(b.tag)));
    } catch (error) {
      console.error("Error fetching quick replies for chat:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las respuestas rápidas para el chat." });
    } finally {
      setIsLoadingQuickReplies(false);
    }
  }, [dataFetchUserId, toast]);

  useEffect(() => {
    fetchQuickReplies();
  }, [fetchQuickReplies]);

  const handleSendMessage = async () => {
    if (!replyMessage.trim() || !selectedChatId || !whatsAppInstance || !user) return;

    // Save to Firestore first for a snappy UI
    const newMessageDataForDb: Omit<ChatMessage, 'id'|'timestamp'> & { timestamp: any } = {
        chat_id: selectedChatId,
        from: whatsAppInstance.phoneNumber || `instance_${whatsAppInstance.id}`,
        to: selectedChatId,
        instance: whatsAppInstance.name,
        instanceId: whatsAppInstance.id,
        mensaje: replyMessage,
        user_name: 'agente',
        timestamp: serverTimestamp(),
        type: chatMode,
        author: {
          uid: user.uid,
          name: user.fullName || user.username || "Agente",
        }
    };
    await addDoc(collection(db, 'chat'), newMessageDataForDb);
    
    // Clear input immediately
    setReplyMessage("");

    if (chatMode === 'message') {
      // Logic for sending message through webhook
      const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
      const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
      const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;
  
      let baseWebhookUrl: string | undefined;
  
      if (useTestWebhook) {
          baseWebhookUrl = testWebhookBase;
          if (!baseWebhookUrl) {
              toast({ variant: "destructive", title: "Configuración Incompleta", description: "URL de webhook de prueba no configurada." });
              return;
          }
      } else {
          baseWebhookUrl = prodWebhookBase;
          if (!baseWebhookUrl) {
              toast({ variant: "destructive", title: "Configuración Incompleta", description: "URL de webhook de producción no configurada." });
              return;
          }
      }
      const webhookUrl = `${baseWebhookUrl}?action=send_message`;
  
      const webhookPayload = {
        number: selectedChatId,
        message: replyMessage,
        instanceName: whatsAppInstance.name,
        token: whatsAppInstance.apiKey,
        userId: user.uid,
      };
      
      try {
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });
        if (!webhookResponse.ok) {
            const errorData = await webhookResponse.json();
            console.error("Error from n8n webhook:", webhookResponse.status, errorData);
            toast({ variant: "destructive", title: "Error de envío", description: errorData.message || `No se pudo enviar el mensaje a través de N8N: ${webhookResponse.statusText}`});
        }
      } catch (error: any) {
        console.error("Error calling n8n webhook:", error);
        toast({ variant: "destructive", title: "Error de Red", description: `No se pudo conectar con N8N: ${error.message}` });
      }
    }
  };
  
  const handleSaveContactDetails = async () => {
    if (!selectedChatId || !dataFetchUserId || !whatsAppInstance || !contactDetails) return;
    setIsSavingContact(true);
    
    const docId = contactDetails.id || getContactDocId(dataFetchUserId, selectedChatId);

    // Create a new object to avoid mutating state directly and remove the ID from the data payload
    const { id: _docIdFromState, ...dataToPersist } = contactDetails; 

    const finalDataToPersist: ContactDetails = {
      ...dataToPersist,
      id: docId,
      userId: dataFetchUserId, 
      instanceId: dataToPersist.instanceId || whatsAppInstance.id, 
      telefono: dataToPersist.telefono || formatPhoneNumber(selectedChatId), 
      _chatIdOriginal: selectedChatId,
      chatbotEnabledForContact: dataToPersist.chatbotEnabledForContact ?? true,
      estadoConversacion: dataToPersist.estadoConversacion ?? 'Abierto',
    };

    try {
      await setDoc(doc(db, 'contacts', docId), finalDataToPersist, { merge: true });
      
      const updatedContactState = { ...finalDataToPersist, id: docId };
      
      const oldAssigneeId = initialContactDetails?.assignedTo;
      const newAssigneeId = finalDataToPersist.assignedTo;
      if (newAssigneeId && newAssigneeId !== oldAssigneeId) {
        const newAssignee = teamMembers.find(m => m.uid === newAssigneeId);
        if (newAssignee && newAssignee.email) {
          try {
            const contactName = `${contactDetails.nombre || ''} ${contactDetails.apellido || ''}`.trim() || contactDetails.telefono || selectedChatId;
            const chatLink = `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/dashboard/chat?chatId=${selectedChatId}`;
            
            await sendAssignmentNotificationEmail({
              assigneeEmail: newAssignee.email,
              assigneeName: newAssignee.fullName,
              assignerName: user?.fullName || user?.email || 'un administrador',
              contactName: contactName,
              chatLink: chatLink,
            });
            toast({ title: "Notificación Enviada", description: `Se ha notificado a ${newAssignee.fullName || newAssignee.email} sobre la asignación.` });
          } catch (emailError) {
             console.error("Error sending assignment notification:", emailError);
             toast({ variant: "destructive", title: "Error de Notificación", description: "No se pudo enviar el correo de notificación al agente." });
          }
        }
      }

      setContactDetails(updatedContactState);
      setInitialContactDetails(updatedContactState); 
      setIsEditingContact(false);
      toast({ title: "Contacto Actualizado", description: "La información del contacto ha sido guardada." });
    } catch (error) {
      console.error("Error saving contact details:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la información del contacto." });
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleContactInputChange = (field: keyof Omit<ContactDetails, 'id' | 'instanceId' | 'userId' | 'tipoCliente' | '_chatIdOriginal' | 'chatbotEnabledForContact' | 'estadoConversacion' | 'assignedTo' | 'assignedToName'>, value: string) => {
    setContactDetails(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleContactSelectChange = (value: ContactDetails['tipoCliente']) => {
    setContactDetails(prev => prev ? { ...prev, tipoCliente: value } : null);
  };
  
  const handleContactSwitchChange = (checked: boolean) => {
     setContactDetails(prev => prev ? { ...prev, chatbotEnabledForContact: checked } : null);
  };

  const handleContactStatusChange = (value: ContactDetails['estadoConversacion']) => {
    setContactDetails(prev => prev ? { ...prev, estadoConversacion: value } : null);
  };

  const handleAssigneeChange = (memberId: string) => {
    const selectedMember = teamMembers.find(m => m.uid === memberId);
    setContactDetails(prev => prev ? { 
        ...prev, 
        assignedTo: selectedMember?.uid || '',
        assignedToName: selectedMember?.fullName || selectedMember?.email || ''
    } : null);
  };

  const handleQuickReplySelect = (tag: string) => {
    if (tag === "none") {
        return;
    }
    const selectedReply = quickReplies.find(qr => qr.tag === tag);
    if (selectedReply) {
      setReplyMessage(prev => prev ? `${prev} ${selectedReply.message}` : selectedReply.message);
    }
  };

  if (isLoadingInstance) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos de la instancia...</p>
      </div>
    );
  }

  if (error && (!whatsAppInstance || whatsAppInstance.status !== 'Conectado')) {
    return (
      <Card className="m-auto mt-10 max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-6 w-6" />
            Error de Instancia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Por favor, ve a la página de <Link href="/dashboard/configuration" className="text-primary underline hover:text-primary/80">Configuración</Link> para conectar o verificar tu instancia.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (!whatsAppInstance || whatsAppInstance.status !== 'Conectado') {
     return (
      <Card className="m-auto mt-10 max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Info className="mr-2 h-6 w-6" />
            Instancia no Conectada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>La instancia de Qyvoo WhatsApp de tu organización no está conectada.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Contacta al administrador de tu organización para que la conecte.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentConvoDetails = conversations.find(c => c.chat_id === selectedChatId);

  const getStatusIndicator = (status?: ContactDetails['estadoConversacion']) => {
    switch(status) {
        case 'Pendiente': return <div className="h-2.5 w-2.5 rounded-full bg-yellow-500 shrink-0"></div>;
        case 'Cerrado': return <div className="h-2.5 w-2.5 rounded-full bg-gray-500 shrink-0"></div>;
        case 'Abierto':
        default:
            return <div className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0"></div>;
    }
  }

  const filteredConversations = conversations.filter(convo => {
    const statusMatch = statusFilter === 'all' || convo.status === statusFilter;
    const assignmentMatch = assignmentFilter === 'all' || (assignmentFilter === 'mine' && convo.assignedTo === user?.uid);
    return statusMatch && assignmentMatch;
  });

  const messagePlaceholder = user?.role === 'agent'
    ? "Escribe tu mensaje como agente..."
    : "Escribe tu mensaje como administrador...";

  return (
    <>
    <div className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] border bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
      {showConversationList && (
        <div className={`
          w-full ${isMobile ? '' : 'md:w-1/3 lg:w-1/4 md:min-w-[300px] md:max-w-[380px]'}
          border-r flex flex-col
        `}>
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Conversaciones</h2>
             <Tabs defaultValue="all" onValueChange={(value) => setAssignmentFilter(value as any)} className="mt-3">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Todos los Chats</TabsTrigger>
                    <TabsTrigger value="mine" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Asignados a Mí</TabsTrigger>
                </TabsList>
            </Tabs>
             <Tabs defaultValue="all" onValueChange={(value) => setStatusFilter(value as any)} className="mt-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Todos</TabsTrigger>
                <TabsTrigger value="Abierto" className="text-xs data-[state=active]:bg-green-500 data-[state=active]:text-primary-foreground">Abiertos</TabsTrigger>
                <TabsTrigger value="Pendiente" className="text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-secondary-foreground">Pend.</TabsTrigger>
                <TabsTrigger value="Cerrado" className="text-xs data-[state=active]:bg-slate-500 data-[state=active]:text-primary-foreground">Cerrados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-grow">
            {isLoadingChats ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Cargando chats...</span>
              </div>
            ) : filteredConversations.length === 0 && !error ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                No hay conversaciones que coincidan con el filtro.
              </div>
            ) : error && !isLoadingChats ? ( 
              <div className="p-6 text-center text-destructive">
                <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
                {error}
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredConversations.map((convo) => (
                  <li key={convo.chat_id}>
                    <Link
                      href={`/dashboard/chat?chatId=${convo.chat_id}`}
                      scroll={false}
                      className={`flex w-full items-start p-3 rounded-none border-b overflow-hidden ${selectedChatId === convo.chat_id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 transition-colors'}`}
                    >
                      <Avatar className="h-10 w-10 mr-3 mt-1 shrink-0">
                        <AvatarFallback>
                          {convo.avatarFallback || formatPhoneNumber(convo.chat_id).slice(-2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <div className="min-w-0 overflow-hidden mr-2 flex items-center gap-2">
                            {getStatusIndicator(convo.status)}
                            <p className="font-semibold text-sm truncate">{convo.nameLine1}</p>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatConversationTimestamp(convo.lastMessageTimestamp)}
                          </p>
                        </div>
                        {convo.nameLine2 && <p className="text-xs text-muted-foreground truncate pl-4">{convo.nameLine2}</p>}
                        {convo.assignedToName && (
                          <p className="text-xs text-muted-foreground truncate flex items-center mt-0.5">
                              <UserCog className="h-3 w-3 mr-1.5 shrink-0" />
                              Asignado a: {convo.assignedToName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          <span className="font-medium">
                           {convo.lastMessageSender === 'bot' ? 'Bot' :
                             convo.lastMessageSender === 'User' ? 'Usuario' :
                             convo.lastMessageAuthorName || 'Agente'}:
                          </span>
                          {convo.lastMessage}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col ${showChatArea ? 'flex' : 'hidden'}`}>
        {selectedChatId ? (
          <>
            {/* Chat Header with mobile back button */}
            <div className="p-4 border-b bg-card flex flex-row items-center justify-between sticky top-0 z-10">
              <div className="flex items-center min-w-0"> 
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="mr-2"
                    onClick={() => {
                      setSelectedChatId(null);
                      router.replace('/dashboard/chat', { scroll: false });
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="text-lg min-w-0"> 
                  {isLoadingMessages && !currentConvoDetails ? (
                    <span className="text-muted-foreground">Cargando...</span>
                  ) : currentConvoDetails ? (
                    <div className="flex flex-col">
                      <span className="font-semibold truncate leading-tight">{currentConvoDetails.nameLine1}</span>
                      {currentConvoDetails.nameLine2 && (
                        <span className="text-xs text-muted-foreground truncate leading-tight">
                          {currentConvoDetails.nameLine2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-semibold truncate">{formatPhoneNumber(selectedChatId)}</span>
                  )}
                </div>
              </div>
              
              {/* Mobile contact info button */}
              {isMobile && (
                <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="p-0 w-[85vw] max-w-sm flex flex-col">
                    {contactDetails && initialContactDetails && (
                      <ContactDetailsPanel
                        contactDetails={contactDetails}
                        initialContactDetails={initialContactDetails}
                        isEditingContact={isEditingContact}
                        setIsEditingContact={setIsEditingContact}
                        isLoadingContact={isLoadingContact}
                        isSavingContact={isSavingContact}
                        teamMembers={teamMembers}
                        nextAppointment={nextAppointment}
                        onSave={handleSaveContactDetails}
                        onCancel={() => { setIsEditingContact(false); setContactDetails(initialContactDetails); }}
                        onInputChange={handleContactInputChange}
                        onSelectChange={handleContactSelectChange}
                        onStatusChange={handleContactStatusChange}
                        onSwitchChange={handleContactSwitchChange}
                        onAssigneeChange={handleAssigneeChange}
                        formatPhoneNumber={formatPhoneNumber}
                        onQuickCreateAppointment={() => setIsAppointmentFormOpen(true)}
                      />
                    )}
                  </SheetContent>
                </Sheet>
              )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-grow p-4 space-y-2 bg-muted/20">
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mb-4" />
                  <p>No hay mensajes en esta conversación.</p>
                  <p className="text-sm">Envía un mensaje para comenzar.</p>
                </div>
              ) : (
                <TooltipProvider>
                  {activeMessages.map((msg) => {
                    if (msg.type === 'internal_note') {
                      return (
                        <div key={msg.id} className="relative my-4 flex items-center justify-center">
                            <div className="absolute inset-x-0 h-px bg-yellow-300 dark:bg-yellow-700"></div>
                            <div className="relative flex items-start gap-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-4 py-2 text-xs text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 shadow-sm">
                                <StickyNote className="h-4 w-4 mt-0.5 shrink-0" />
                                <div className="max-w-sm">
                                    <p className="font-bold">{msg.author?.name || 'Agente'}</p>
                                    <p className="whitespace-pre-wrap break-all">{msg.mensaje}</p>
                                    <p className="text-right text-yellow-600 dark:text-yellow-500 mt-1">{formatChatMessageTimestamp(msg.timestamp)}</p>
                                </div>
                            </div>
                        </div>
                      );
                    }

                    const isExternalUser = msg.user_name?.toLowerCase() === 'user'; 

                    let alignmentClass: string;
                    let bubbleClass: string;
                    let timestampAlignmentClass: string;
                    let IconComponent: React.ElementType | null = null;
                    let avatarTooltipContent: string | null = null;
                    
                    if (isExternalUser) {
                      alignmentClass = 'justify-start'; 
                      bubbleClass = 'bg-card border'; 
                      timestampAlignmentClass = 'text-muted-foreground text-left';
                      IconComponent = UserRound; 
                    } else { 
                      alignmentClass = 'justify-end'; 
                      timestampAlignmentClass = 'text-right';

                      if (msg.user_name === 'bot') {
                        bubbleClass = 'bg-primary text-primary-foreground';
                        timestampAlignmentClass += ' text-primary-foreground/80';
                        IconComponent = Bot;
                        avatarTooltipContent = "Bot";
                      } else { // Agent or Admin
                        bubbleClass = 'bg-accent text-accent-foreground';
                        timestampAlignmentClass += ' text-accent-foreground/80';
                        IconComponent = User; 
                        avatarTooltipContent = msg.author?.name || "Agente";
                      }
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full items-end gap-2 ${alignmentClass}`}
                      >
                        {isExternalUser && IconComponent && <IconComponent className="h-6 w-6 text-muted-foreground shrink-0 mb-1" />}
                        
                        <div className={`py-2 px-3 rounded-2xl shadow-sm max-w-[75%] ${bubbleClass}`}>
                          <div className="text-sm break-all whitespace-pre-wrap leading-relaxed">
                            {formatWhatsAppMessage(msg.mensaje)}
                          </div>
                          <p className={`text-xs mt-1.5 ${timestampAlignmentClass}`}>
                            {formatChatMessageTimestamp(msg.timestamp)}
                          </p>
                        </div>

                        {!isExternalUser && IconComponent && (
                           <Tooltip>
                              <TooltipTrigger asChild>
                                  <IconComponent className="h-6 w-6 text-muted-foreground shrink-0 mb-1" />
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{avatarTooltipContent}</p>
                              </TooltipContent>
                           </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </TooltipProvider>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Message Input Area */}
            <div className="p-4 border-t bg-card flex flex-col space-y-2 sticky bottom-0">
               <Tabs value={chatMode} onValueChange={(value) => setChatMode(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="message">Mensaje al Cliente</TabsTrigger>
                  <TabsTrigger value="internal_note">Nota Interna</TabsTrigger>
                </TabsList>
                <div className="mt-2">
                  {chatMode === 'message' && (
                    <div className="w-full mb-2">
                      <Select onValueChange={handleQuickReplySelect} disabled={isLoadingQuickReplies || quickReplies.length === 0}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={
                            isLoadingQuickReplies ? "Cargando respuestas..." :
                            quickReplies.length === 0 ? "No hay respuestas rápidas" :
                            "Seleccionar respuesta rápida..."
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Seleccionar respuesta rápida...</SelectItem>
                          {quickReplies.map((qr) => (
                            <SelectItem key={qr.id} value={qr.tag}>
                              {qr.tag} - <span className="text-xs text-muted-foreground truncate max-w-[200px] inline-block">{qr.message}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        <Link href="/dashboard/quick-replies" className="hover:underline">
                          Gestionar respuestas rápidas <Zap className="inline h-3 w-3" />
                        </Link>
                      </p>
                    </div>
                  )}
                  <div className="flex w-full items-center space-x-2">
                    <Textarea
                      placeholder={chatMode === 'message' ? messagePlaceholder : "Añade una nota para tu equipo (no se enviará al cliente)..."}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="flex-grow resize-none"
                      rows={1}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!replyMessage.trim() || isLoadingMessages}
                      className="shrink-0"
                      size="lg"
                    >
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Enviar</span>
                    </Button>
                  </div>
                </div>
              </Tabs>
            </div>
          </>
        ) : ( 
          <div className={`${isMobile ? 'hidden' : 'flex'} flex-1 flex-col items-center justify-center p-6 bg-muted/20`}>
            <div className="text-center max-w-md">
              <EvolveLinkLogo className="h-16 w-auto mx-auto mb-6 text-primary" data-ai-hint="company logo"/>
              <h2 className="text-2xl font-semibold mb-2">Bienvenido a Qyvoo</h2>
              <p className="text-muted-foreground mb-6">
                Selecciona una conversación de la lista de la izquierda para ver los mensajes.
              </p>
              <Alert className="bg-background border-border text-foreground">
                <MessageCircle className="h-5 w-5" />
                <AlertTitle className="font-semibold">Panel de Monitoreo</AlertTitle>
                <AlertDescription>
                  Esta interfaz te permite monitorear las conversaciones de tus campañas y responder como administrador.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Contact Panel - Only visible on desktop when chat is selected */}
      <div className={`hidden md:flex w-full md:w-1/3 lg:w-1/4 md:min-w-[300px] md:max-w-[380px] border-l flex-col bg-card ${showContactPanelDesktop ? 'md:flex' : 'md:hidden'}`}>
          <ContactDetailsPanel
            contactDetails={contactDetails}
            initialContactDetails={initialContactDetails}
            isEditingContact={isEditingContact}
            setIsEditingContact={setIsEditingContact}
            isLoadingContact={isLoadingContact}
            isSavingContact={isSavingContact}
            teamMembers={teamMembers}
            nextAppointment={nextAppointment}
            onSave={handleSaveContactDetails}
            onCancel={() => { setIsEditingContact(false); setContactDetails(initialContactDetails); }}
            onInputChange={handleContactInputChange}
            onSelectChange={handleContactSelectChange}
            onStatusChange={handleContactStatusChange}
            onSwitchChange={handleContactSwitchChange}
            onAssigneeChange={handleAssigneeChange}
            formatPhoneNumber={formatPhoneNumber}
            onQuickCreateAppointment={() => setIsAppointmentFormOpen(true)}
          />
      </div>
    </div>
    
    {isAppointmentFormOpen && contactDetails && (
        <AppointmentForm 
            isOpen={isAppointmentFormOpen}
            setIsOpen={setIsAppointmentFormOpen}
            appointment={null}
            contacts={allContacts} // Pass all contacts for the dropdown
            teamMembers={teamMembers}
            onSave={() => {
                toast({ title: "Cita Creada", description: "La cita ha sido agendada desde el chat." });
                fetchContactAndAppointmentDetails(); // Refresh appointment info in chat panel
            }}
            // Pre-select the current contact
            selectedDate={new Date()} // Default to today, user can change
            initialContactId={contactDetails.id}
        />
    )}
    </>
  );
}


"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { 
  doc, getDoc, 
  collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, Timestamp as FirestoreTimestamp,
  setDoc, onSnapshot
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EvolveLinkLogo } from '@/components/icons';
import { Loader2, MessageCircle, AlertTriangle, Info, User, Send, Edit3, Save, XCircle, Building, MapPin, Mail, Phone, UserCheck, Bot, UserRound } from 'lucide-react';
import type { WhatsAppInstance } from '../configuration/page'; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface ChatMessageDocument {
  chat_id: string;
  from: string;
  instance: string;
  instanceId: string;
  mensaje: string;
  timestamp: FirestoreTimestamp; 
  to: string;
  user_name: 'User' | 'bot' | 'agente' | string; 
}

interface ChatMessage extends ChatMessageDocument {
  id: string; 
}

interface ConversationSummary {
  chat_id: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSender: string;
}

interface ContactDetails {
  id?: string; 
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  tipoCliente?: 'Prospecto' | 'Cliente' | 'Proveedor' | 'Otro';
  instanceId?: string;
  userId?: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoadingInstance, setIsLoadingInstance] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");

  const [contactDetails, setContactDetails] = useState<ContactDetails | null>(null);
  const [initialContactDetails, setInitialContactDetails] = useState<ContactDetails | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isLoadingContact, setIsLoadingContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages]);

  useEffect(() => {
    if (user) {
      const fetchInstance = async () => {
        setIsLoadingInstance(true);
        setError(null);
        try {
          const instanceDocRef = doc(db, 'instances', user.uid);
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
  }, [user]);

  useEffect(() => {
    if (whatsAppInstance && whatsAppInstance.status === 'Conectado' && (whatsAppInstance.id || whatsAppInstance.name)) {
      const fetchConversations = async () => {
        setIsLoadingChats(true);
        setError(null);
        try {
          const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
          
          const q = query(
            collection(db, 'chat'),
            where('instanceId', '==', instanceIdentifier),
            orderBy('timestamp', 'desc')
          );
          
          const querySnapshot = await getDocs(q);
          const messages: ChatMessage[] = [];
          querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
          });
          
          const chatMap = new Map<string, ConversationSummary>();
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
              });
            }
          });
          
          const sortedConversations = Array.from(chatMap.values()).sort(
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
  }, [whatsAppInstance]);

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

  useEffect(() => {
    if (selectedChatId && user && whatsAppInstance) {
      setIsLoadingContact(true);
      const fetchDetails = async () => {
        try {
          const contactDocRef = doc(db, 'contacts', selectedChatId);
          const contactDocSnap = await getDoc(contactDocRef);
          if (contactDocSnap.exists()) {
            const data = { id: contactDocSnap.id, ...contactDocSnap.data() } as ContactDetails;
            setContactDetails(data);
            setInitialContactDetails(data);
          } else {
            const initialData: ContactDetails = { 
              id: selectedChatId, 
              telefono: formatPhoneNumber(selectedChatId),
              nombre: "",
              apellido: "",
              email: "",
              empresa: "",
              ubicacion: "",
              tipoCliente: undefined,
              instanceId: whatsAppInstance.id,
              userId: user.uid,
            };
            setContactDetails(initialData); 
            setInitialContactDetails(initialData);
          }
        } catch (error) {
          console.error("Error fetching contact details:", error);
           toast({ variant: "destructive", title: "Error", description: "Error al cargar detalles del contacto." });
        } finally {
          setIsLoadingContact(false);
        }
      };
      fetchDetails();
      setIsEditingContact(false); 
    } else {
      setContactDetails(null);
      setInitialContactDetails(null);
      setIsEditingContact(false);
    }
  }, [selectedChatId, user, whatsAppInstance, toast]);

  const handleSendMessage = async () => {
    if (!replyMessage.trim() || !selectedChatId || !whatsAppInstance || !user) return;

    const trimmedMessage = replyMessage.trim();

    const newMessageData: Omit<ChatMessage, 'id' | 'timestamp'> & { timestamp: any } = {
      chat_id: selectedChatId, 
      from: whatsAppInstance.phoneNumber || `instance_${whatsAppInstance.id}`, 
      to: selectedChatId, 
      instance: whatsAppInstance.name,
      instanceId: whatsAppInstance.id,
      mensaje: trimmedMessage,
      user_name: 'agente', 
      timestamp: serverTimestamp(), 
    };

    try {
      await addDoc(collection(db, 'chat'), newMessageData);
      setReplyMessage("");
      toast({ title: "Mensaje Guardado", description: "Tu mensaje ha sido guardado en el chat." });

      // Call the webhook
      const webhookPayload = [{
        chat_id: selectedChatId,
        instanceId: whatsAppInstance.id,
        mensaje: trimmedMessage,
        instance: whatsAppInstance.name,
        user_name: "agent", // As per user's example for webhook
        timestamp: new Date().toISOString(),
      }];

      const webhookUrl = "https://n8n.vemontech.com/webhook/qyvoo"; // Updated URL

      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          console.log("Message successfully sent to webhook:", webhookPayload);
          toast({ title: "Mensaje Enviado a Qyvoo", description: "El mensaje también fue enviado al sistema Qyvoo." });
        } else {
          const errorData = await webhookResponse.text();
          console.error("Error sending message to webhook:", webhookResponse.status, errorData);
          toast({ variant: "destructive", title: "Error de Webhook", description: `No se pudo enviar el mensaje a Qyvoo: ${webhookResponse.status}` });
        }
      } catch (webhookError) {
        console.error("Error calling webhook:", webhookError);
        toast({ variant: "destructive", title: "Error de Red Webhook", description: "No se pudo conectar con el servicio de Qyvoo." });
      }

    } catch (error) {
      console.error("Error sending message (Firestore):", error);
      setError("Error al enviar el mensaje a Firestore.");
      toast({ variant: "destructive", title: "Error en Firestore", description: "No se pudo guardar el mensaje." });
    }
  };
  
  const handleSaveContactDetails = async () => {
    if (!contactDetails || !selectedChatId || !user || !whatsAppInstance) return;
    setIsSavingContact(true);
    try {
      const contactDocRef = doc(db, 'contacts', selectedChatId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...detailsToSave } = contactDetails; 

      const dataToSave: ContactDetails = {
        nombre: detailsToSave.nombre || "",
        apellido: detailsToSave.apellido || "",
        email: detailsToSave.email || "", 
        telefono: detailsToSave.telefono || "",
        empresa: detailsToSave.empresa || "",
        ubicacion: detailsToSave.ubicacion || "",
        tipoCliente: detailsToSave.tipoCliente || undefined, 
        instanceId: detailsToSave.instanceId || whatsAppInstance.id,
        userId: detailsToSave.userId || user.uid,
      };

      await setDoc(contactDocRef, dataToSave, { merge: true });
      setInitialContactDetails(contactDetails); 
      setIsEditingContact(false);
      toast({ title: "Contacto Actualizado", description: "La información del contacto ha sido guardada." });
    } catch (error) {
      console.error("Error saving contact details:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la información del contacto." });
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleContactInputChange = (field: keyof Omit<ContactDetails, 'id' | 'instanceId' | 'userId' | 'tipoCliente'>, value: string) => {
    setContactDetails(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleContactSelectChange = (value: string) => {
    setContactDetails(prev => prev ? { ...prev, tipoCliente: value as ContactDetails['tipoCliente'] } : null);
  };

  const formatPhoneNumber = (chat_id: string) => {
    if (!chat_id) return "Desconocido";
    return chat_id.split('@')[0];
  };

  const formatTimestamp = (timestamp: FirestoreTimestamp | Date | undefined): string => {
    if (!timestamp) return "";
    const date = timestamp instanceof FirestoreTimestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      <Card className="m-auto mt-10 max-w-lg shadow-lg">
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
      <Card className="m-auto mt-10 max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Info className="mr-2 h-6 w-6" />
            Instancia no Conectada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Tu instancia de Qyvoo WhatsApp no está conectada o no se encontró.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Por favor, ve a la página de <Link href="/dashboard/configuration" className="text-primary underline hover:text-primary/80">Configuración</Link> para conectar o verificar tu instancia.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] border bg-card text-card-foreground shadow-sm rounded-lg overflow-hidden">
      {/* Left Column: Conversation List */}
      <div className="w-full md:w-1/3 lg:w-1/4 md:min-w-[300px] md:max-w-[380px] border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Conversaciones Activas</h2>
        </div>
        <ScrollArea className="flex-grow">
          {isLoadingChats ? (
             <div className="flex items-center justify-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Cargando chats...</span>
            </div>
          ) : conversations.length === 0 && !error ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              No hay conversaciones activas.
            </div>
          ) : error && !isLoadingChats ? ( 
             <div className="p-6 text-center text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
              {error}
            </div>
          ) : (
            <ul>
              {conversations.map((convo) => (
                <li key={convo.chat_id}>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedChatId(convo.chat_id)}
                    className={`w-full h-auto justify-start text-left p-3 rounded-none border-b ${selectedChatId === convo.chat_id ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                       <AvatarFallback>
                        {formatPhoneNumber(convo.chat_id).slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-grow overflow-hidden">
                      <p className="font-semibold truncate">{formatPhoneNumber(convo.chat_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">
                          {convo.lastMessageSender?.toLowerCase() === 'bot' ? 'Bot' : 
                           convo.lastMessageSender?.toLowerCase() === 'agente' ? 'Agente' : 
                           convo.lastMessageSender?.toLowerCase() === 'user' ? 'Usuario' : 'Usuario'}: 
                        </span>
                        {convo.lastMessage}
                      </p>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Middle Column: Chat View */}
      <div className="flex-1 flex flex-col bg-muted/30">
        {selectedChatId ? (
          <>
            <CardHeader className="p-4 border-b bg-card">
              <CardTitle className="text-lg">Chat con {formatPhoneNumber(selectedChatId)}</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-grow p-4 space-y-3">
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
                activeMessages.map((msg) => {
                  const userNameLower = msg.user_name?.toLowerCase();
                  const isExternalUser = userNameLower === 'user'; 

                  let alignmentClass: string;
                  let bubbleClass: string;
                  let timestampAlignmentClass: string;
                  let IconComponent: React.ElementType | null = null;
                  let avatarFallbackClass: string;
                  
                  if (isExternalUser) {
                    alignmentClass = 'justify-start'; 
                    bubbleClass = 'bg-muted dark:bg-slate-700'; 
                    timestampAlignmentClass = 'text-muted-foreground text-left';
                    IconComponent = User;
                    avatarFallbackClass = "bg-gray-400 text-white";
                  } else { 
                    alignmentClass = 'justify-end'; 
                    timestampAlignmentClass = 'text-right';

                    if (userNameLower === 'bot') {
                      bubbleClass = 'bg-primary text-primary-foreground';
                      timestampAlignmentClass += ' text-primary-foreground/80';
                      IconComponent = Bot;
                      avatarFallbackClass = "bg-blue-500 text-white";
                    } else if (userNameLower === 'agente') {
                      bubbleClass = 'bg-secondary text-secondary-foreground dark:bg-slate-600 dark:text-slate-100';
                      timestampAlignmentClass += ' text-secondary-foreground/80';
                      IconComponent = User; 
                      avatarFallbackClass = "bg-green-500 text-white";
                    } else { // Fallback for other system messages if any
                      bubbleClass = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
                      timestampAlignmentClass += ' text-gray-500 dark:text-gray-400';
                      IconComponent = MessageCircle; 
                      avatarFallbackClass = "bg-gray-300 dark:bg-gray-600 text-black dark:text-white";
                    }
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${alignmentClass}`}
                    >
                      <div className={`flex items-end max-w-[75%] gap-2`}>
                        {IconComponent && isExternalUser && (
                          <Avatar className={`h-6 w-6 self-end mb-1`}>
                            <AvatarFallback className={avatarFallbackClass}>
                              <IconComponent className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div
                          className={`py-2 px-3 rounded-lg shadow-md ${bubbleClass}`}
                        >
                          <p className="text-sm break-words">{msg.mensaje}</p>
                          <p className={`text-xs mt-1 ${timestampAlignmentClass}`}>
                            {formatTimestamp(msg.timestamp)}
                          </p>
                        </div>

                        {IconComponent && !isExternalUser && (
                          <Avatar className={`h-6 w-6 self-end mb-1`}>
                             <AvatarFallback className={avatarFallbackClass}>
                              <IconComponent className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>
            <CardFooter className="p-4 border-t bg-card">
              <div className="flex w-full items-center space-x-2">
                <Textarea
                  placeholder="Escribe tu mensaje como administrador..."
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
                <Button onClick={handleSendMessage} disabled={!replyMessage.trim() || isLoadingMessages}>
                  <Send className="h-4 w-4 mr-2" /> Enviar
                </Button>
              </div>
            </CardFooter>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-6">
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
      
      {/* Right Column: Additional Information */}
      {selectedChatId && (
        <div className="w-full md:w-1/3 lg:w-1/4 md:min-w-[300px] md:max-w-[380px] border-l flex flex-col bg-card">
          <CardHeader className="p-4 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Información del Contacto</CardTitle>
              {!isEditingContact && (
                <Button variant="ghost" size="icon" onClick={() => setIsEditingContact(true)} disabled={isLoadingContact}>
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <ScrollArea className="flex-grow p-4">
            {isLoadingContact ? (
               <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : contactDetails ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="contactNombre" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-4 w-4 mr-2"/>Nombre</Label>
                  <Input id="contactNombre" value={contactDetails.nombre || ""} onChange={(e) => handleContactInputChange('nombre', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactApellido" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-4 w-4 mr-2"/>Apellido</Label>
                  <Input id="contactApellido" value={contactDetails.apellido || ""} onChange={(e) => handleContactInputChange('apellido', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactEmail" className="flex items-center text-sm text-muted-foreground"><Mail className="h-4 w-4 mr-2"/>Correo Electrónico</Label>
                  <Input id="contactEmail" value={contactDetails.email || ""} onChange={(e) => handleContactInputChange('email', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactTelefono" className="flex items-center text-sm text-muted-foreground"><Phone className="h-4 w-4 mr-2"/>Teléfono</Label>
                  <Input id="contactTelefono" value={contactDetails.telefono || ""} onChange={(e) => handleContactInputChange('telefono', e.target.value)} readOnly={!isEditingContact || !!contactDetails.telefono && contactDetails.telefono === formatPhoneNumber(selectedChatId)} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactEmpresa" className="flex items-center text-sm text-muted-foreground"><Building className="h-4 w-4 mr-2"/>Empresa</Label>
                  <Input id="contactEmpresa" value={contactDetails.empresa || ""} onChange={(e) => handleContactInputChange('empresa', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactUbicacion" className="flex items-center text-sm text-muted-foreground"><MapPin className="h-4 w-4 mr-2"/>Ubicación</Label>
                  <Input id="contactUbicacion" value={contactDetails.ubicacion || ""} onChange={(e) => handleContactInputChange('ubicacion', e.target.value)} readOnly={!isEditingContact} placeholder="No disponible"/>
                </div>
                <div>
                  <Label htmlFor="contactTipoCliente" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-4 w-4 mr-2"/>Tipo de Cliente</Label>
                   <Select 
                    value={contactDetails.tipoCliente || ""} 
                    onValueChange={handleContactSelectChange}
                    disabled={!isEditingContact}
                  >
                    <SelectTrigger id="contactTipoCliente">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prospecto">Prospecto</SelectItem>
                      <SelectItem value="Cliente">Cliente</SelectItem>
                      <SelectItem value="Proveedor">Proveedor</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {isEditingContact && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => { setIsEditingContact(false); setContactDetails(initialContactDetails);}} disabled={isSavingContact}>
                      <XCircle className="mr-2 h-4 w-4" /> Cancelar
                    </Button>
                    <Button onClick={handleSaveContactDetails} disabled={isSavingContact}>
                      {isSavingContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No hay información de contacto disponible para {formatPhoneNumber(selectedChatId)}.</p>
            )}
          </ScrollArea>
           <CardFooter className="p-2 border-t">
             <p className="text-xs text-muted-foreground text-center w-full">Información de contacto adicional.</p>
          </CardFooter>
        </div>
      )}
    </div>
  );
}

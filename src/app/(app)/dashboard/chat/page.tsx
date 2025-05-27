
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, MessageCircle, AlertTriangle, Info, User, Send, Edit3, Save, XCircle, Building, MapPin, Mail, Phone, UserCheck, Bot } from 'lucide-react';
import type { WhatsAppInstance } from '../configuration/page'; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';

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
  email?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  tipoCliente?: 'Prospecto' | 'Cliente' | 'Proveedor' | 'Otro';
}

export default function ChatPage() {
  const { user } = useAuth();
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
        // Query for messages where EITHER 'from' or 'to' is the selectedChatId,
        // AND the other participant is the instance's number.
        // This assumes a more complex setup or that chat_id is always the *other* participant.
        // A simpler, often effective way if chat_id always represents the *other* party:
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
    if (selectedChatId) {
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
            setContactDetails({ id: selectedChatId, telefono: formatPhoneNumber(selectedChatId) }); 
            setInitialContactDetails({ id: selectedChatId, telefono: formatPhoneNumber(selectedChatId) });
          }
        } catch (error) {
          console.error("Error fetching contact details:", error);
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
  }, [selectedChatId]);

  const handleSendMessage = async () => {
    if (!replyMessage.trim() || !selectedChatId || !whatsAppInstance || !user) return;

    const newMessageData: Omit<ChatMessage, 'id' | 'timestamp'> & { timestamp: any } = {
      chat_id: selectedChatId, 
      from: whatsAppInstance.phoneNumber, 
      to: selectedChatId, 
      instance: whatsAppInstance.name,
      instanceId: whatsAppInstance.id,
      mensaje: replyMessage.trim(),
      user_name: 'agente', 
      timestamp: serverTimestamp(), 
    };

    try {
      await addDoc(collection(db, 'chat'), newMessageData);
      setReplyMessage("");
      console.log("Message saved to Firestore. TODO: Implement Qyvoo webhook call to send the message via WhatsApp.");
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Error al enviar el mensaje.");
    }
  };
  
  const handleSaveContactDetails = async () => {
    if (!contactDetails || !selectedChatId) return;
    setIsSavingContact(true);
    try {
      const contactDocRef = doc(db, 'contacts', selectedChatId);
      const { id, ...detailsToSave } = contactDetails;
      await setDoc(contactDocRef, { 
        ...detailsToSave,
        email: detailsToSave.email || null, 
        telefono: detailsToSave.telefono || null,
        empresa: detailsToSave.empresa || null,
        ubicacion: detailsToSave.ubicacion || null,
        tipoCliente: detailsToSave.tipoCliente || null,
       }, { merge: true });
      setInitialContactDetails(contactDetails); 
      setIsEditingContact(false);
    } catch (error) {
      console.error("Error saving contact details:", error);
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleContactInputChange = (field: keyof Omit<ContactDetails, 'id'>, value: string) => {
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
                           convo.lastMessageSender?.toLowerCase() === 'agente' ? 'Agente' : 'Usuario'}: 
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
                  const isFromExternalContact = msg.from === selectedChatId;
                  const isBotMessage = !isFromExternalContact && msg.user_name?.toLowerCase() === 'bot';
                  const isAgentMessage = !isFromExternalContact && msg.user_name?.toLowerCase() === 'agente';

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${!isFromExternalContact ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex items-end space-x-2 max-w-[75%]`}>
                        {/* Icono para el usuario externo (a la izquierda de su burbuja) */}
                        {isFromExternalContact && (
                          <Avatar className="h-6 w-6 self-end mb-1">
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}

                        {/* Icono para el Bot (a la izquierda de su burbuja) */}
                        {isBotMessage && (
                           <Avatar className="h-6 w-6 self-end mb-1">
                             <AvatarFallback className="bg-primary text-primary-foreground">
                               <Bot className="h-4 w-4" />
                             </AvatarFallback>
                           </Avatar>
                        )}
                        {/* Icono para el Agente (a la izquierda de su burbuja) */}
                        {isAgentMessage && (
                           <Avatar className="h-6 w-6 self-end mb-1">
                             <AvatarFallback className="bg-secondary text-secondary-foreground">
                               <User className="h-4 w-4" />
                             </AvatarFallback>
                           </Avatar>
                        )}
                        
                        {/* Burbuja del mensaje */}
                        <div
                          className={`py-2 px-3 rounded-lg shadow-md ${
                            isFromExternalContact
                              ? 'bg-muted' // Mensajes del Contacto Externo (IZQUIERDA)
                              : isBotMessage
                              ? 'bg-primary text-primary-foreground' // Mensajes del Bot (DERECHA)
                              : isAgentMessage
                              ? 'bg-secondary text-secondary-foreground' // Mensajes del Agente (DERECHA)
                              : 'bg-gray-200' // Fallback
                          }`}
                        >
                          <p className="text-sm">{msg.mensaje}</p>
                          <p className={`text-xs mt-1 ${
                            isFromExternalContact
                              ? 'text-muted-foreground'
                              : isBotMessage
                              ? 'text-primary-foreground/80'
                              : isAgentMessage
                              ? 'text-secondary-foreground/80'
                              : 'text-gray-500'
                          } text-right`}>
                            {formatTimestamp(msg.timestamp)}
                          </p>
                        </div>
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


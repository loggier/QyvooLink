
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { WhatsAppInstance } from '@/app/(app)/dashboard/configuration/page';
import type { ChatMessageDocument } from '@/app/(app)/dashboard/chat/page'; // Asumiendo que esta interfaz está bien definida aquí

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save, User, Bot, MessageCircle, UserRound, Building, Mail, Phone, UserCheck, MapPin, MessageSquareDashed, ListTodo } from 'lucide-react';

interface ContactDetails {
  id: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  tipoCliente?: 'Prospecto' | 'Cliente' | 'Proveedor' | 'Otro';
  estadoConversacion?: 'Abierto' | 'Pendiente' | 'Cerrado';
  chatbotEnabledForContact?: boolean;
  userId: string;
  _chatIdOriginal?: string;
}

interface ChatMessage extends ChatMessageDocument {
  id: string;
}

const formatPhoneNumber = (chat_id: string | undefined): string => {
  if (!chat_id) return "Desconocido";
  return chat_id.split('@')[0];
};

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


export default function ContactDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const contactId = typeof params.contactId === 'string' ? params.contactId : '';

  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [formData, setFormData] = useState<Partial<ContactDetails>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchContactDetails = useCallback(async () => {
    if (!user || !contactId) return;
    setIsLoading(true);
    try {
      const contactDocRef = doc(db, 'contacts', contactId);
      const contactDocSnap = await getDoc(contactDocRef);
      if (contactDocSnap.exists()) {
        const data = { id: contactDocSnap.id, ...contactDocSnap.data() } as ContactDetails;
        if (data.userId !== user.uid) {
          toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permiso para ver este contacto." });
          router.push('/dashboard/contacts');
          return;
        }
        setContact(data);
        setFormData({
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          email: data.email || "",
          telefono: data.telefono || "",
          empresa: data.empresa || "",
          ubicacion: data.ubicacion || "",
          tipoCliente: data.tipoCliente,
          estadoConversacion: data.estadoConversacion || 'Abierto',
          chatbotEnabledForContact: data.chatbotEnabledForContact ?? true,
          _chatIdOriginal: data._chatIdOriginal
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Contacto no encontrado." });
        router.push('/dashboard/contacts');
      }
    } catch (error) {
      console.error("Error fetching contact details:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el contacto." });
    } finally {
      setIsLoading(false);
    }
  }, [user, contactId, toast, router]);

  const fetchWhatsAppInstance = useCallback(async () => {
    if (!user) return;
    try {
      const instanceDocRef = doc(db, 'instances', user.uid);
      const instanceDocSnap = await getDoc(instanceDocRef);
      if (instanceDocSnap.exists()) {
        setWhatsAppInstance(instanceDocSnap.data() as WhatsAppInstance);
      }
    } catch (error) {
      console.error("Error fetching WhatsApp instance:", error);
      // No toast aquí para no molestar si es un error menor
    }
  }, [user]);

  useEffect(() => {
    fetchContactDetails();
    fetchWhatsAppInstance();
  }, [fetchContactDetails, fetchWhatsAppInstance]);

  useEffect(() => {
    if (contact?._chatIdOriginal && whatsAppInstance) {
      setIsLoadingMessages(true);
      const instanceIdentifier = whatsAppInstance.id || whatsAppInstance.name;
      const q = query(
        collection(db, 'chat'),
        where('instanceId', '==', instanceIdentifier),
        where('chat_id', '==', contact._chatIdOriginal),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedMessages: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
          fetchedMessages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
        });
        setMessages(fetchedMessages);
        setIsLoadingMessages(false);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, (error) => {
        console.error("Error fetching messages for contact:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los mensajes." });
        setIsLoadingMessages(false);
      });
      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [contact, whatsAppInstance, toast]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: 'tipoCliente' | 'estadoConversacion', value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, chatbotEnabledForContact: checked }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !contact) return;
    setIsSaving(true);

    const updatedContactData: Partial<ContactDetails> = {
      ...formData,
      chatbotEnabledForContact: formData.chatbotEnabledForContact ?? true,
      estadoConversacion: formData.estadoConversacion ?? 'Abierto',
    };

    try {
      await setDoc(doc(db, 'contacts', contact.id), updatedContactData, { merge: true });
      toast({ title: "Contacto Actualizado", description: "La información del contacto ha sido guardada." });
      // Actualizar el estado local del contacto también
      setContact(prev => prev ? { ...prev, ...updatedContactData } as ContactDetails : null);
    } catch (error) {
      console.error("Error updating contact:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el contacto." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const formatTimestamp = (timestamp: FirestoreTimestamp | Date | undefined): string => {
    if (!timestamp) return "";
    const date = timestamp instanceof FirestoreTimestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading || !contact) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Cargando detalles del contacto...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/dashboard/contacts')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Contactos
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna de Información y Edición del Contacto */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserRound className="mr-2 h-6 w-6 text-primary"/>
              Detalles del Contacto
            </CardTitle>
            <CardDescription>Edita la información de {contact.nombre || 'este contacto'}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nombre" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-3 w-3 mr-1.5"/>Nombre</Label>
                <Input id="nombre" name="nombre" value={formData.nombre || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="apellido" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-3 w-3 mr-1.5"/>Apellido</Label>
                <Input id="apellido" name="apellido" value={formData.apellido || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center text-sm text-muted-foreground"><Mail className="h-3 w-3 mr-1.5"/>Correo Electrónico</Label>
                <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="telefono" className="flex items-center text-sm text-muted-foreground"><Phone className="h-3 w-3 mr-1.5"/>Teléfono</Label>
                <Input id="telefono" name="telefono" value={formData.telefono || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="empresa" className="flex items-center text-sm text-muted-foreground"><Building className="h-3 w-3 mr-1.5"/>Empresa</Label>
                <Input id="empresa" name="empresa" value={formData.empresa || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="ubicacion" className="flex items-center text-sm text-muted-foreground"><MapPin className="h-3 w-3 mr-1.5"/>Ubicación</Label>
                <Input id="ubicacion" name="ubicacion" value={formData.ubicacion || ""} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="tipoCliente" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-3 w-3 mr-1.5"/>Tipo de Cliente</Label>
                <Select name="tipoCliente" value={formData.tipoCliente || ""} onValueChange={(value) => handleSelectChange('tipoCliente', value)}>
                  <SelectTrigger id="tipoCliente">
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
              <div>
                <Label htmlFor="estadoConversacion" className="flex items-center text-sm text-muted-foreground"><ListTodo className="h-3 w-3 mr-1.5"/>Estado Conversación</Label>
                <Select name="estadoConversacion" value={formData.estadoConversacion || "Abierto"} onValueChange={(value) => handleSelectChange('estadoConversacion', value)}>
                  <SelectTrigger id="estadoConversacion">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abierto">Abierto</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div>
                <Label htmlFor="_chatIdOriginal" className="flex items-center text-sm text-muted-foreground"><MessageCircle className="h-3 w-3 mr-1.5"/>Chat ID Original (WhatsApp)</Label>
                <Input id="_chatIdOriginal" name="_chatIdOriginal" value={formData._chatIdOriginal || ""} onChange={handleInputChange} placeholder="Ej: 1234567890@s.whatsapp.net"/>
                 <p className="text-xs text-muted-foreground mt-1">Este ID se usa para vincular las conversaciones de WhatsApp. Edítalo con cuidado.</p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="chatbotEnabledForContact" checked={formData.chatbotEnabledForContact ?? true} onCheckedChange={handleSwitchChange} />
                <Label htmlFor="chatbotEnabledForContact" className="flex items-center text-sm text-muted-foreground">
                  <Bot className="h-4 w-4 mr-2" /> Chatbot Activo
                </Label>
              </div>
              {!(formData.chatbotEnabledForContact ?? true) && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 flex items-center">
                    <MessageSquareDashed className="h-3 w-3 mr-1" /> El bot no responderá automáticamente a este contacto.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Columna de Conversaciones */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageCircle className="mr-2 h-6 w-6 text-primary"/>
              Historial de Conversaciones
            </CardTitle>
            <CardDescription>
              {contact._chatIdOriginal ? `Mensajes con ${formatPhoneNumber(contact._chatIdOriginal)}.` : "No hay un Chat ID de WhatsApp asociado para mostrar conversaciones."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[600px] flex flex-col"> {/* Altura fija para la tarjeta de chat */}
            {contact._chatIdOriginal && whatsAppInstance ? (
              isLoadingMessages ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                  <p>No hay mensajes en esta conversación.</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 pr-4 space-y-3"> {/* ScrollArea toma el espacio restante */}
                  {messages.map((msg) => {
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
                       IconComponent = UserRound; 
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
                       } else { 
                         bubbleClass = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
                         timestampAlignmentClass += ' text-gray-500 dark:text-gray-400';
                         IconComponent = MessageCircle; 
                         avatarFallbackClass = "bg-gray-300 dark:bg-gray-600 text-black dark:text-white";
                       }
                     }
                     return (
                      <div key={msg.id} className={`flex w-full ${alignmentClass}`}>
                        <div className={`flex items-end max-w-[75%] gap-2`}>
                           {IconComponent && isExternalUser && (
                            <Avatar className={`h-6 w-6 self-end mb-1`}>
                              <AvatarFallback className={avatarFallbackClass}>
                                <IconComponent className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`py-2 px-3 rounded-lg shadow-md ${bubbleClass}`}>
                            <p className="text-sm break-all whitespace-pre-wrap">
                              {formatWhatsAppMessage(msg.mensaje)}
                            </p>
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
                    })}
                  <div ref={messagesEndRef} />
                </ScrollArea>
              )
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                <p>
                  {contact._chatIdOriginal ? "Cargando instancia de WhatsApp..." : "Este contacto no tiene un Chat ID de WhatsApp para mostrar mensajes."}
                </p>
              </div>
            )}
          </CardContent>
           {/* <CardFooter>
             Podríamos añadir un input para enviar mensajes desde aquí si fuera necesario en el futuro.
           </CardFooter> */}
        </Card>
      </div>
    </div>
  );
}

    

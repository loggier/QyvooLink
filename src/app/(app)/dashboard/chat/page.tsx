
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EvolveLinkLogo } from '@/components/icons';
import { Loader2, MessageCircle, AlertTriangle, Info, User } from 'lucide-react';
import type { WhatsAppInstance } from '../configuration/page'; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';

interface ChatMessageDocument {
  chat_id: string;
  from: string;
  instance: string;
  instanceId: string;
  mensaje: string;
  timestamp: FirestoreTimestamp; // Firestore Timestamp
  to: string;
  user_name: 'User' | 'bot' | 'agente' | string;
}

interface ChatMessage extends ChatMessageDocument {
  id: string; // Document ID from Firestore
}

interface ConversationSummary {
  chat_id: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSender: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [whatsAppInstance, setWhatsAppInstance] = useState<WhatsAppInstance | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoadingInstance, setIsLoadingInstance] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch WhatsApp Instance
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

  // Fetch Conversations if instance is connected
  useEffect(() => {
    if (whatsAppInstance && whatsAppInstance.status === 'Conectado' && (whatsAppInstance.instanceId || whatsAppInstance.name)) {
      const fetchConversations = async () => {
        setIsLoadingChats(true);
        setError(null);
        try {
          // This client-side grouping can be inefficient for large datasets.
          // Consider using Cloud Functions to maintain a pre-aggregated 'conversations' collection.
          let q;
          const instanceIdentifier = whatsAppInstance.instanceId || whatsAppInstance.name;
          
          if (whatsAppInstance.instanceId) {
             q = query(
              collection(db, 'chat'),
              where('instanceId', '==', instanceIdentifier),
              orderBy('timestamp', 'desc')
            );
          } else { // Fallback to instance name if instanceId is not available (though it should be)
             q = query(
              collection(db, 'chat'),
              where('instance', '==', instanceIdentifier),
              orderBy('timestamp', 'desc')
            );
          }

          const querySnapshot = await getDocs(q);
          const messages: ChatMessage[] = [];
          querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...(doc.data() as ChatMessageDocument) });
          });
          
          const chatMap = new Map<string, ConversationSummary>();
          messages.forEach(msg => {
            if (!chatMap.has(msg.chat_id)) {
              chatMap.set(msg.chat_id, {
                chat_id: msg.chat_id,
                lastMessage: msg.mensaje,
                lastMessageTimestamp: msg.timestamp.toDate(),
                lastMessageSender: msg.user_name,
              });
            }
            // Since messages are ordered by timestamp desc, the first one encountered for a chat_id is the latest.
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

  const formatPhoneNumber = (chat_id: string) => {
    return chat_id.split('@')[0];
  }

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
      <div className="w-full md:w-1/3 md:min-w-[300px] md:max-w-[380px] border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Conversaciones Activas</h2>
          {/* Optional: Search bar here */}
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
          ) : error ? (
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
                        {formatPhoneNumber(convo.chat_id).slice(-2)} {/* Last 2 digits for fallback */}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-grow overflow-hidden">
                      <p className="font-semibold truncate">{formatPhoneNumber(convo.chat_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">{convo.lastMessageSender === 'bot' ? 'Bot' : convo.lastMessageSender === 'agente' ? 'Agente' : 'Usuario'}: </span>
                        {convo.lastMessage}
                      </p>
                    </div>
                    {/* Optional: Timestamp or unread count */}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Right Column: Chat View / Welcome */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-6 bg-muted/30">
        {selectedChatId ? (
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-2">Chat con {formatPhoneNumber(selectedChatId)}</h3>
            <p className="text-muted-foreground">La visualización de mensajes detallados y la funcionalidad de envío estarán disponibles próximamente.</p>
            {/* Future: Chat messages display and input */}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

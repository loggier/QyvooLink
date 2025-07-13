
"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Wifi, WifiOff, BotMessageSquare, MessageCircleOff, FlaskConical, Users, FileText, Loader2, AlertTriangle, HelpCircle, ListChecks, MessagesSquare } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, Timestamp as FirestoreTimestamp, getCountFromServer } from 'firebase/firestore';
import type { WhatsAppInstance } from './configuration/page'; 
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Interfaces necesarias para el Dashboard
interface ChatMessageDocument {
  chat_id: string;
  from: string;
  instanceId: string;
  mensaje: string;
  timestamp: FirestoreTimestamp;
  to: string;
  user_name: 'User' | 'bot' | 'agente' | string;
}

interface BotConfigData {
  promptXml?: string;
  activeBotId?: string;
}

interface ContactDetails {
  id?: string;
  nombre?: string;
  apellido?: string;
  empresa?: string;
}

interface DashboardStats {
  instanceStatus: 'Conectado' | 'Desconectado' | 'Pendiente' | 'No Configurada' | 'Error' | 'Cargando';
  isChatbotGloballyEnabled?: boolean;
  isDemoMode?: boolean;
  contactCount: number | string;
  conversationCount: number | string;
  isBotPromptConfigured?: boolean;
}

interface DashboardConversationSummary {
  chat_id: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSender: string;
  displayName: string;
  avatarFallback: string;
}

const initialStats: DashboardStats = {
  instanceStatus: 'Cargando',
  contactCount: 'Cargando...',
  conversationCount: 'Cargando...',
  isChatbotGloballyEnabled: undefined,
  isDemoMode: undefined,
  isBotPromptConfigured: undefined,
};

const formatPhoneNumber = (chat_id: string | undefined): string => {
  if (!chat_id) return "Desconocido";
  return chat_id.split('@')[0];
};

const getContactDocId = (userId: string, chatId: string): string => `${userId}_${chatId.replace(/@/g, '_')}`;

const truncateText = (text: string | undefined, maxLength: number): string => {
  if (!text) return "";
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trimEnd() + "...";
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [recentConversations, setRecentConversations] = useState<DashboardConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Determine which user's data to fetch. For agents, use the owner's ID.
  const dataFetchUserId = user?.role === 'agent' ? user?.ownerId : user?.uid;

  useEffect(() => {
    if (dataFetchUserId && !authLoading) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          let instanceStatusVal: DashboardStats['instanceStatus'] = 'No Configurada';
          let contactsVal: number | string = 0;
          let conversationsVal: number | string = 0;
          let instanceIdForChats: string | null = null;

          const instanceDocRef = doc(db, 'instances', dataFetchUserId);
          const instanceDocSnap = await getDoc(instanceDocRef);

          let instanceData: WhatsAppInstance | null = null;
          if (instanceDocSnap.exists()) {
            instanceData = instanceDocSnap.data() as WhatsAppInstance;
            instanceStatusVal = instanceData.status || 'Pendiente';
            instanceIdForChats = instanceData.id || instanceData.name;
          }

          let botPromptConfiguredVal = false;
          const botConfigDocRef = doc(db, 'qybot', dataFetchUserId);
          const botConfigDocSnap = await getDoc(botConfigDocRef);
          if (botConfigDocSnap.exists()) {
             const botConfig = botConfigDocSnap.data() as BotConfigData;
             if (botConfig.promptXml && botConfig.promptXml.trim() !== "") {
                botPromptConfiguredVal = true;
             }
          }

          try {
            const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', dataFetchUserId));
            const contactsSnapshot = await getCountFromServer(contactsQuery);
            contactsVal = contactsSnapshot.data().count;
          } catch (e) {
            console.error("Error fetching contacts count:", e);
            contactsVal = "Error";
          }

          let fetchedRecentConversations: DashboardConversationSummary[] = [];
          if (instanceIdForChats) {
            try {
              const chatQuery = query(
                collection(db, 'chat'),
                where('instanceId', '==', instanceIdForChats),
                orderBy('timestamp', 'desc'),
                limit(200) 
              );
              const chatSnapshot = await getDocs(chatQuery);
              const messages: ChatMessageDocument[] = [];
              chatSnapshot.forEach((doc) => {
                messages.push(doc.data() as ChatMessageDocument);
              });

              const chatMap = new Map<string, ChatMessageDocument>();
              messages.forEach(msg => {
                let currentChatId = msg.chat_id;
                if (instanceIdForChats) {
                    if (msg.from === instanceIdForChats) { 
                        currentChatId = msg.to;
                    } else if (msg.to === instanceIdForChats) { 
                        currentChatId = msg.from;
                    }
                }
                if (msg.chat_id.endsWith('@g.us')) { 
                    currentChatId = msg.chat_id;
                }

                if (!chatMap.has(currentChatId) || msg.timestamp.toDate() > chatMap.get(currentChatId)!.timestamp.toDate()) {
                  chatMap.set(currentChatId, msg);
                }
              });
              
              conversationsVal = chatMap.size; 

              const sortedUniqueMessages = Array.from(chatMap.values()).sort(
                (a,b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
              );

              const top5Messages = sortedUniqueMessages.slice(0, 5);

              const contactPromises = top5Messages.map(async (msg) => {
                let currentChatId = msg.chat_id;
                 if (instanceIdForChats) {
                    if (msg.from === instanceIdForChats) currentChatId = msg.to;
                    else if (msg.to === instanceIdForChats) currentChatId = msg.from;
                 }
                 if (msg.chat_id.endsWith('@g.us')) currentChatId = msg.chat_id;

                let contactData: ContactDetails | null = null;
                try {
                    const contactQuery = query(
                        collection(db, 'contacts'),
                        where('userId', '==', dataFetchUserId!),
                        where('_chatIdOriginal', '==', currentChatId),
                        limit(1)
                    );
                    const contactSnapshot = await getDocs(contactQuery);
                    if (!contactSnapshot.empty) {
                        contactData = contactSnapshot.docs[0].data() as ContactDetails;
                    }
                } catch (contactError) {
                    console.warn(`Error fetching contact for ${currentChatId}:`, contactError);
                }

                let displayName = formatPhoneNumber(currentChatId);
                let avatarFallbackText = displayName.length >= 2 ? displayName.slice(-2) : displayName;

                if (contactData) {
                    let nameParts = [];
                    if (contactData.nombre && contactData.nombre.trim()) nameParts.push(contactData.nombre.trim());
                    if (contactData.apellido && contactData.apellido.trim()) nameParts.push(contactData.apellido.trim());
                    
                    let tempDisplayName = nameParts.join(' ').trim();
                    if (contactData.empresa && contactData.empresa.trim()) {
                        tempDisplayName += ` [${contactData.empresa.trim()}]`;
                    }
                    
                    if (tempDisplayName.trim()) {
                        displayName = tempDisplayName.trim();
                        if (contactData.nombre && contactData.nombre.trim() && contactData.apellido && contactData.apellido.trim()) {
                            avatarFallbackText = `${contactData.nombre.trim()[0]}${contactData.apellido.trim()[0]}`.toUpperCase();
                        } else if (contactData.nombre && contactData.nombre.trim() && contactData.nombre.trim().length >=2) {
                            avatarFallbackText = contactData.nombre.trim().substring(0,2).toUpperCase();
                        } else if (contactData.nombre && contactData.nombre.trim()) {
                           avatarFallbackText = contactData.nombre.trim().substring(0,1).toUpperCase();
                        } else if (contactData.empresa && contactData.empresa.trim() && contactData.empresa.trim().length >= 2) {
                            avatarFallbackText = contactData.empresa.trim().substring(0,2).toUpperCase();
                        } else if (contactData.empresa && contactData.empresa.trim()) {
                           avatarFallbackText = contactData.empresa.trim().substring(0,1).toUpperCase();
                        }
                    }
                }

                return {
                  chat_id: currentChatId,
                  lastMessage: msg.mensaje,
                  lastMessageTimestamp: msg.timestamp.toDate(),
                  lastMessageSender: msg.user_name,
                  displayName: displayName,
                  avatarFallback: avatarFallbackText,
                };
              });
              
              fetchedRecentConversations = await Promise.all(contactPromises);

            } catch (e) {
              console.error("Error fetching conversations:", e);
              conversationsVal = "Error";
              fetchedRecentConversations = [];
            }
          } else {
            conversationsVal = 0;
            fetchedRecentConversations = [];
          }
          setRecentConversations(fetchedRecentConversations);

          setStats({
            instanceStatus: instanceStatusVal,
            isChatbotGloballyEnabled: instanceData?.chatbotEnabled ?? true,
            isDemoMode: instanceData?.demo ?? false,
            contactCount: contactsVal,
            conversationCount: conversationsVal,
            isBotPromptConfigured: botPromptConfiguredVal,
          });
        } catch (error) {
          console.error("Dashboard data fetch error:", error);
          setStats({
            instanceStatus: 'Error',
            contactCount: 'Error',
            conversationCount: 'Error',
            isChatbotGloballyEnabled: undefined,
            isDemoMode: undefined,
            isBotPromptConfigured: false,
          });
          setRecentConversations([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else if (!authLoading && !user) {
        setIsLoading(false);
        setRecentConversations([]);
    }
  }, [dataFetchUserId, authLoading, user]);

  if (isLoading || authLoading) { 
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos del panel...</p>
      </div>
    );
  }

  const getStatusColor = (status: DashboardStats['instanceStatus']) => {
    switch (status) {
      case 'Conectado': return 'text-green-500';
      case 'Desconectado': return 'text-red-500';
      case 'Pendiente': return 'text-yellow-500';
      case 'No Configurada': return 'text-slate-500';
      case 'Error': return 'text-red-700';
      default: return 'text-muted-foreground';
    }
  };

  const getInstanceStatusIcon = (status: DashboardStats['instanceStatus']) => {
    switch (status) {
      case 'Conectado': return <Wifi className={`h-5 w-5 ${getStatusColor(status)}`} />;
      case 'Desconectado': return <WifiOff className={`h-5 w-5 ${getStatusColor(status)}`} />;
      case 'Pendiente': return <Loader2 className={`h-5 w-5 animate-spin ${getStatusColor(status)}`} />;
      case 'No Configurada': return <HelpCircle className={`h-5 w-5 ${getStatusColor(status)}`} />;
      case 'Error': return <AlertTriangle className={`h-5 w-5 ${getStatusColor(status)}`} />;
      default: return <Loader2 className={`h-5 w-5 animate-spin ${getStatusColor(status)}`} />;
    }
  };

  const isAgent = user?.role === 'agent';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Resumen del Panel</h2>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {!isAgent && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estado de la Instancia</CardTitle>
                {getInstanceStatusIcon(stats.instanceStatus)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(stats.instanceStatus)}`}>
                  {stats.instanceStatus}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.instanceStatus === 'Conectado' ? 'Lista para operar.' : 
                  stats.instanceStatus === 'No Configurada' ? 'Ve a Configuración para empezar.' :
                  stats.instanceStatus === 'Pendiente' ? 'Esperando conexión o QR.' :
                  stats.instanceStatus === 'Desconectado' ? 'Requiere acción para reconectar.' :
                  stats.instanceStatus === 'Cargando' ? 'Verificando estado...' : 
                  stats.instanceStatus === 'Error' ? 'Error al cargar estado.' :
                  'Revisa la configuración.'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chatbot Global</CardTitle>
                {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' || stats.isChatbotGloballyEnabled === undefined 
                ? <HelpCircle className="h-5 w-5 text-slate-500" /> 
                : stats.isChatbotGloballyEnabled 
                  ? <BotMessageSquare className="h-5 w-5 text-green-500" /> 
                  : <MessageCircleOff className="h-5 w-5 text-red-500" />}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' || stats.isChatbotGloballyEnabled === undefined ? 'text-slate-500' : stats.isChatbotGloballyEnabled ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' ? "N/A" :
                  stats.isChatbotGloballyEnabled === undefined ? "No Definido" : 
                  stats.isChatbotGloballyEnabled ? "Activado" : "Desactivado"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' ? "Requiere instancia configurada." :
                  stats.isChatbotGloballyEnabled === undefined ? "Define en Configuración." : 
                  stats.isChatbotGloballyEnabled ? "Respondiendo mensajes automáticamente." : "Solo respuestas manuales."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Modo Demo</CardTitle>
                {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' || stats.isDemoMode === undefined 
                  ? <HelpCircle className="h-5 w-5 text-slate-500" /> 
                  : stats.isDemoMode 
                    ? <FlaskConical className="h-5 w-5 text-blue-500" /> 
                    : <FlaskConical className="h-5 w-5 text-slate-500 opacity-50" />}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' || stats.isDemoMode === undefined ? 'text-slate-500' : stats.isDemoMode ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
                    {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' ? "N/A" :
                    stats.isDemoMode === undefined ? "No Definido" : 
                    stats.isDemoMode ? "Activado" : "Desactivado"}
                </div>
                <p className="text-xs text-muted-foreground">
                    {stats.instanceStatus === 'No Configurada' || stats.instanceStatus === 'Cargando' ? "Requiere instancia configurada." :
                    stats.isDemoMode === undefined ? "Define en Configuración." : 
                    stats.isDemoMode ? "Simulando interacciones." : "Operando en modo real."}
                </p>
              </CardContent>
            </Card>
          </>
        )}
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contactos Guardados</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contactCount}</div>
            <p className="text-xs text-muted-foreground">Contactos en la agenda de la organización.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversaciones Activas</CardTitle>
            <ListChecks className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversationCount}</div>
            <p className="text-xs text-muted-foreground">Hilos de chat únicos registrados.</p>
          </CardContent>
        </Card>

        {!isAgent && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prompt del Bot</CardTitle>
              {stats.isBotPromptConfigured === undefined ? <HelpCircle className="h-5 w-5 text-slate-500" /> : 
                stats.isBotPromptConfigured ? <FileText className="h-5 w-5 text-green-500" /> : <FileText className="h-5 w-5 text-red-500" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.isBotPromptConfigured === undefined ? 'text-slate-500' : stats.isBotPromptConfigured ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.isBotPromptConfigured === undefined ? "No Verificado" : stats.isBotPromptConfigured ? "Configurado" : "Pendiente"}
              </div>
              <p className="text-xs text-muted-foreground">
                  {stats.isBotPromptConfigured === undefined ? "Ve a Configurar Bot." : stats.isBotPromptConfigured ? "Instrucciones y reglas definidas." : "Configura el prompt del bot."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas 5 conversaciones iniciadas o actualizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Cargando actividad...</p>
            </div>
          ) : recentConversations.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed">
              <MessagesSquare className="h-12 w-12 text-muted-foreground/70" />
              <p className="mt-4 text-center text-muted-foreground">
                No hay actividad reciente para mostrar. <br />
                Las nuevas conversaciones aparecerán aquí.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-72">
              <ul className="space-y-2 pr-3">
                {recentConversations.map((convo) => (
                  <li key={convo.chat_id}>
                    <Link href={`/dashboard/chat?chatId=${convo.chat_id}`} className="block hover:bg-muted p-3 rounded-lg transition-colors">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{convo.avatarFallback}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-semibold text-foreground truncate">{convo.displayName}</p>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(convo.lastMessageTimestamp, { addSuffix: true, locale: es })}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">
                              {convo.lastMessageSender === 'User' ? 'Usuario' : convo.lastMessageSender === 'bot' ? 'Bot' : convo.lastMessageSender === 'agente' ? 'Agente' : 'Otro'}:
                            </span> {truncateText(convo.lastMessage, 70)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

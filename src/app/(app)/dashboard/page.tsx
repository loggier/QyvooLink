
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, BotMessageSquare, MessageCircleOff, FlaskConical, Users, MessageSquare, FileText, Loader2, AlertTriangle, HelpCircle, MessageSquareText, ListChecks } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { WhatsAppInstance } from './configuration/page'; 
import type { BotConfigData } from './bot-config/page'; 
import type { ChatMessageDocument } from './chat/page'; // Asumiendo que esta interfaz puede ser importada

interface DashboardStats {
  instanceStatus: 'Conectado' | 'Desconectado' | 'Pendiente' | 'No Configurada' | 'Error' | 'Cargando';
  isChatbotGloballyEnabled?: boolean;
  isDemoMode?: boolean;
  contactCount: number | string;
  conversationCount: number | string;
  isBotPromptConfigured?: boolean;
}

const initialStats: DashboardStats = {
  instanceStatus: 'Cargando',
  contactCount: 'Cargando...',
  conversationCount: 'Cargando...',
  isChatbotGloballyEnabled: undefined,
  isDemoMode: undefined,
  isBotPromptConfigured: undefined,
};


export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          let instanceStatusVal: DashboardStats['instanceStatus'] = 'No Configurada';
          let chatbotEnabledVal: boolean | undefined = undefined;
          let demoModeVal: boolean | undefined = undefined;
          let contactsVal: number | string = 0;
          let conversationsVal: number | string = 0;
          let instanceIdForChats: string | null = null;

          // Fetch instance data
          const instanceDocRef = doc(db, 'instances', user.uid);
          const instanceDocSnap = await getDoc(instanceDocRef);

          if (instanceDocSnap.exists()) {
            const instanceData = instanceDocSnap.data() as WhatsAppInstance;
            instanceStatusVal = instanceData.status || 'Pendiente';
            chatbotEnabledVal = instanceData.chatbotEnabled;
            demoModeVal = instanceData.demo;
            instanceIdForChats = instanceData.id || instanceData.name; // Para la consulta de chats
            // contactsVal y conversationsVal se calcularán a continuación desde Firestore
          }

          // Fetch bot configuration data
          let botPromptConfiguredVal = false;
          const botConfigDocRef = doc(db, 'qybot', user.uid);
          const botConfigDocSnap = await getDoc(botConfigDocRef);
          if (botConfigDocSnap.exists()) {
             const botConfig = botConfigDocSnap.data() as BotConfigData;
             if (botConfig.agentRole && botConfig.agentRole.trim() !== "" && botConfig.promptXml && botConfig.promptXml.trim() !== "") {
                botPromptConfiguredVal = true;
             }
          }

          // Fetch contacts count from 'contacts' collection
          try {
            const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', user.uid));
            const contactsSnapshot = await getDocs(contactsQuery);
            contactsVal = contactsSnapshot.size;
          } catch (e) {
            console.error("Error fetching contacts count:", e);
            contactsVal = "Error";
          }

          // Fetch active conversations count from 'chat' collection
          if (instanceIdForChats) {
            try {
              const chatQuery = query(
                collection(db, 'chat'),
                where('instanceId', '==', instanceIdForChats)
              );
              const chatSnapshot = await getDocs(chatQuery);
              const chatMessages: ChatMessageDocument[] = [];
              chatSnapshot.forEach((doc) => {
                chatMessages.push(doc.data() as ChatMessageDocument);
              });

              const chatMap = new Map<string, any>();
              chatMessages.forEach(msg => {
                let currentChatId = msg.chat_id;
                if (instanceIdForChats) { // Asegurar que instanceIdForChats no es null
                    if (msg.from === instanceIdForChats) { 
                        currentChatId = msg.to;
                    } else if (msg.to === instanceIdForChats) { 
                        currentChatId = msg.from;
                    }
                }
                // Para grupos, el chat_id es el identificador del grupo
                if (msg.chat_id.endsWith('@g.us')) { 
                    currentChatId = msg.chat_id;
                }
                // Solo se añade si no existe para contar conversaciones únicas
                if (!chatMap.has(currentChatId)) {
                  chatMap.set(currentChatId, {}); // El valor no importa, solo las claves
                }
              });
              conversationsVal = chatMap.size;

            } catch (e) {
              console.error("Error fetching conversations count:", e);
              conversationsVal = "Error";
            }
          } else {
            conversationsVal = 0; // Si no hay instancia, no hay conversaciones
          }


          setStats({
            instanceStatus: instanceStatusVal,
            isChatbotGloballyEnabled: chatbotEnabledVal,
            isDemoMode: demoModeVal,
            contactCount: contactsVal,
            conversationCount: conversationsVal,
            isBotPromptConfigured: botPromptConfiguredVal,
          });
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
          setStats({
            instanceStatus: 'Error',
            contactCount: 'Error',
            conversationCount: 'Error',
            isChatbotGloballyEnabled: undefined,
            isDemoMode: undefined,
            isBotPromptConfigured: false,
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(true); 
    }
  }, [user]);

  if (isLoading) {
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


  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-foreground">Resumen del Panel</h2>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            {stats.isChatbotGloballyEnabled === undefined && stats.instanceStatus !== 'No Configurada' && stats.instanceStatus !== 'Cargando' ? <HelpCircle className="h-5 w-5 text-slate-500" /> : 
             stats.isChatbotGloballyEnabled ? <BotMessageSquare className="h-5 w-5 text-green-500" /> : <MessageCircleOff className="h-5 w-5 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.isChatbotGloballyEnabled === undefined && stats.instanceStatus !== 'No Configurada' && stats.instanceStatus !== 'Cargando' ? 'text-slate-500' : stats.isChatbotGloballyEnabled ? 'text-green-500' : 'text-red-500'}`}>
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
             {stats.isDemoMode === undefined && stats.instanceStatus !== 'No Configurada' && stats.instanceStatus !== 'Cargando' ? <HelpCircle className="h-5 w-5 text-slate-500" /> : 
              stats.isDemoMode ? <FlaskConical className="h-5 w-5 text-blue-500" /> : <FlaskConical className="h-5 w-5 text-slate-500 opacity-50" />}
          </CardHeader>
          <CardContent>
             <div className={`text-2xl font-bold ${stats.isDemoMode === undefined && stats.instanceStatus !== 'No Configurada' && stats.instanceStatus !== 'Cargando' ? 'text-slate-500' : stats.isDemoMode ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
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
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contactos Guardados</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contactCount}</div>
            <p className="text-xs text-muted-foreground">Contactos en tu agenda personal.</p>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Resumen de acciones y eventos recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
            <p className="text-muted-foreground">La actividad reciente se mostrará aquí (Próximamente).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


    

"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, MessagesSquare, Bot, UserCog, Loader2, User, Star } from "lucide-react";
import ChartsSection from "@/components/reports/ChartsSection";
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { WhatsAppInstance } from '../configuration/page';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Interfaces para los datos del reporte ---
interface ReportStats {
  totalMessages: number;
  totalContacts: number;
  userMessages: number;
  botMessages: number;
  agentMessages: number;
}

interface MessageDistribution {
  name: string;
  count: number;
  fill: string;
}

interface MessagesByDay {
  date: string;
  total: number;
}

interface TopContact {
  id: string;
  name: string;
  messageCount: number;
}

// --- Configuración de los gráficos ---
const chartConfigMessages = {
  count: { label: "Mensajes" },
  user: { label: "Usuario", color: "hsl(var(--chart-2))" },
  bot: { label: "Bot", color: "hsl(var(--chart-1))" },
  agent: { label: "Agente", color: "hsl(var(--chart-3))" },
} satisfies import("@/components/ui/chart").ChartConfig;

const chartConfigTrend = {
  total: { label: "Total Mensajes", color: "hsl(var(--chart-1))" },
} satisfies import("@/components/ui/chart").ChartConfig;


export default function ReportsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [messageDistribution, setMessageDistribution] = useState<MessageDistribution[]>([]);
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([]);
  const [topContacts, setTopContacts] = useState<TopContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReportData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Obtener la instancia del usuario
      const instanceDocRef = doc(db, 'instances', user.uid);
      const instanceDocSnap = await getDoc(instanceDocRef);
      if (!instanceDocSnap.exists()) {
        setIsLoading(false);
        return;
      }
      const instance = instanceDocSnap.data() as WhatsAppInstance;
      const instanceId = instance.id || instance.name;

      // 2. Obtener mensajes de los últimos 30 días para optimizar lecturas
      const thirtyDaysAgo = subDays(new Date(), 30);
      const messagesQuery = query(
        collection(db, 'chat'), 
        where('instanceId', '==', instanceId),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo))
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(d => ({ ...d.data(), timestamp: d.data().timestamp.toDate() }));
      
      // 3. Calcular estadísticas de mensajes
      let userMessages = 0, botMessages = 0, agentMessages = 0;
      const messageCountByChatId: Record<string, number> = {};
      const today = startOfDay(new Date());
      const dailyCounts: Record<string, number> = {};

      for (let i = 0; i < 7; i++) {
        const day = format(subDays(today, i), 'yyyy-MM-dd');
        dailyCounts[day] = 0;
      }
      
      messages.forEach(msg => {
        const userName = msg.user_name?.toLowerCase();
        if (userName === 'user') userMessages++;
        else if (userName === 'bot') botMessages++;
        else if (userName === 'agente') agentMessages++;

        // Contar mensajes por chat_id
        const chatId = msg.chat_id;
        messageCountByChatId[chatId] = (messageCountByChatId[chatId] || 0) + 1;
        
        // Contar mensajes por día para la gráfica de tendencia
        const msgDay = format(startOfDay(msg.timestamp), 'yyyy-MM-dd');
        if (msgDay in dailyCounts) {
            dailyCounts[msgDay]++;
        }
      });
      
      // 4. Formatear datos para las gráficas
      setMessageDistribution([
        { name: "Usuario", count: userMessages, fill: "var(--color-user)" },
        { name: "Bot", count: botMessages, fill: "var(--color-bot)" },
        { name: "Agente", count: agentMessages, fill: "var(--color-agent)" },
      ]);
      
      setMessagesByDay(
        Object.entries(dailyCounts)
          .map(([date, total]) => ({ date: format(new Date(date), 'dd MMM', { locale: es }), total }))
          .reverse()
      );

      // 5. Obtener el total de contactos
      const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', user.uid));
      const contactsSnapshot = await getDocs(contactsQuery);

      setStats({
        totalMessages: messages.length,
        totalContacts: contactsSnapshot.size,
        userMessages,
        botMessages,
        agentMessages,
      });

      // 6. Obtener los Top Contacts
      const sortedContacts = Object.entries(messageCountByChatId).sort(([, a], [, b]) => b - a).slice(0, 5);
      const topContactsData: TopContact[] = await Promise.all(
        sortedContacts.map(async ([chatId, messageCount]) => {
          const contactId = `${user.uid}_${chatId.replace(/@/g, '_')}`;
          const contactDocRef = doc(db, 'contacts', contactId);
          const contactDocSnap = await getDoc(contactDocRef);
          let name = chatId.split('@')[0];
          if (contactDocSnap.exists()) {
              const contactData = contactDocSnap.data();
              name = `${contactData.nombre || ''} ${contactData.apellido || ''}`.trim() || name;
          }
          return { id: chatId, name, messageCount };
        })
      );
      setTopContacts(topContactsData);

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-150px)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos de reportes...</p>
      </div>
    );
  }
  
  if (!stats) {
     return (
       <div className="text-center py-10">
         <h2 className="text-2xl font-semibold">No hay datos para mostrar</h2>
         <p className="text-muted-foreground mt-2">
           Asegúrate de tener una instancia de Qyvoo configurada y conversaciones activas.
         </p>
       </div>
     );
  }

  const userMsgPercentage = stats.totalMessages > 0 ? ((stats.userMessages / stats.totalMessages) * 100).toFixed(1) : 0;
  const botMsgPercentage = stats.totalMessages > 0 ? ((stats.botMessages / stats.totalMessages) * 100).toFixed(1) : 0;
  const agentMsgPercentage = stats.totalMessages > 0 ? ((stats.agentMessages / stats.totalMessages) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Reportes y Analíticas</h2>
        <p className="text-muted-foreground">
          Visualiza los datos clave de tu operación con Qyvoo de los últimos 30 días.
        </p>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensajes</CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">En los últimos 30 días</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contactos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">Contactos en tu agenda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes del Bot</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{botMsgPercentage}%</div>
            <p className="text-xs text-muted-foreground">{stats.botMessages} mensajes automatizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes de Agentes</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentMsgPercentage}%</div>
            <p className="text-xs text-muted-foreground">{stats.agentMessages} mensajes manuales</p>
          </CardContent>
        </Card>
      </div>

      <ChartsSection
        messageDistributionData={messageDistribution}
        chartConfigMessages={chartConfigMessages}
        messageTrendData={messagesByDay}
        chartConfigTrend={chartConfigTrend}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Star className="mr-2 h-5 w-5 text-yellow-400"/>
            Top 5 Contactos por Actividad
          </CardTitle>
          <CardDescription>Contactos con el mayor número de mensajes intercambiados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Total de Mensajes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium flex items-center">
                    <User className="h-4 w-4 mr-2 text-muted-foreground"/>
                    {contact.name}
                  </TableCell>
                  <TableCell className="text-right font-bold">{contact.messageCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

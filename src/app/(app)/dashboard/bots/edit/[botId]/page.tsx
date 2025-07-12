
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { updateBotAndPrompt } from '../../actions';
import type { BotData, BotCategory } from '../../page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ArrowLeft, BotIcon } from 'lucide-react';
import VentasBotForm from '@/components/bots/VentasBotForm';
import SoporteTecnicoBotForm from '@/components/bots/SoporteTecnicoBotForm';
import AtencionClienteBotForm from '@/components/bots/AtencionClienteBotForm';
import AgenteInmobiliarioBotForm from '@/components/bots/AgenteInmobiliarioBotForm';
import AsistentePersonalBotForm from '@/components/bots/AsistentePersonalBotForm';

export default function EditBotPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const botId = params.botId as string;

  const [bot, setBot] = useState<BotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBot = useCallback(async () => {
    if (!user || !botId) return;
    setIsLoading(true);
    try {
      const botDocRef = doc(db, 'bots', botId);
      const botDocSnap = await getDoc(botDocRef);
      if (botDocSnap.exists()) {
        const botData = { id: botDocSnap.id, ...botDocSnap.data() } as BotData;
        if (botData.userId !== user.uid) {
          toast({ variant: 'destructive', title: 'Acceso denegado' });
          router.push('/dashboard/bots');
          return;
        }
        setBot(botData);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Bot no encontrado.' });
        router.push('/dashboard/bots');
      }
    } catch (error) {
      console.error("Error fetching bot:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el bot.' });
    } finally {
      setIsLoading(false);
    }
  }, [user, botId, toast, router]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  const handleDataChange = (updatedData: Partial<BotData>) => {
    setBot(prev => prev ? { ...prev, ...updatedData } : null);
  };

  const handleSave = async () => {
    if (!user || !bot) return;
    setIsSaving(true);
    
    // Create a plain object to send to the server action, removing the complex Timestamp object.
    // The server action will handle Timestamps on its own.
    const { createdAt, ...serializableBotData } = bot;

    const dataToSend = {
      ...serializableBotData,
      // Convert Timestamp to a serializable format if needed by the server action,
      // or simply omit it if the server action doesn't update it.
      // For this action, the server handles it, so we can pass the simplified object.
    };

    try {
      // Pass the serializable object to the server action
      await updateBotAndPrompt(dataToSend);

      if (bot.isActive) {
        toast({ title: "Bot Guardado y Activado", description: "La configuración del bot activo ha sido actualizada." });
      } else {
        toast({ title: "Bot Guardado", description: "Los cambios han sido guardados." });
      }

    } catch (error) {
      console.error("Error saving bot:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración.' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderFormForCategory = (category: BotCategory) => {
    if (!bot) return null;

    switch (category) {
      case 'Ventas':
        return <VentasBotForm data={bot} onDataChange={handleDataChange} />;
      case 'Atención al Cliente':
        return <AtencionClienteBotForm data={bot} onDataChange={handleDataChange} />;
      case 'Soporte Técnico':
          return <SoporteTecnicoBotForm data={bot} onDataChange={handleDataChange} />;
      case 'Agente Inmobiliario':
          return <AgenteInmobiliarioBotForm data={bot} onDataChange={handleDataChange} />;
      case 'Asistente Personal':
          return <AsistentePersonalBotForm data={bot} onDataChange={handleDataChange} />;
      default:
        return <p>Categoría de bot no reconocida.</p>;
    }
  };

  if (isLoading || !bot) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/bots')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Mis Bots
          </Button>
          <h2 className="text-3xl font-bold tracking-tight text-foreground mt-2">
            Configurar: {bot.name}
          </h2>
          <p className="text-muted-foreground">
            Editando un asistente de la categoría: <span className="font-semibold text-primary">{bot.category}</span>
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nombre del Asistente</CardTitle>
          <CardDescription>Este nombre es solo para tu referencia interna.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="botName">Nombre</Label>
          <Input 
            id="botName"
            value={bot.name}
            onChange={(e) => handleDataChange({ name: e.target.value })}
          />
        </CardContent>
      </Card>
      
      {renderFormForCategory(bot.category)}
    </div>
  );
}

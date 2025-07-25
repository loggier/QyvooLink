
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, writeBatch, Timestamp, orderBy, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { activateBot, migrateAndActivateLegacyBot } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bot, PlusCircle, Edit, Trash2, BotIcon } from 'lucide-react';
import { generateSafeId } from '@/lib/uuid';

export type BotCategory = 'Ventas' | 'Atención al Cliente' | 'Asistente Personal' | 'Agente Inmobiliario' | 'Soporte Técnico';

export interface DriveLink {
  id: string;
  name: string;
  description?: string;
  type: 'Catálogo de Productos' | 'Base de Conocimiento' | 'Preguntas Frecuentes' | 'Otro';
  url: string;
}

export interface BotData {
  id: string;
  userId: string;
  name: string;
  category: BotCategory;
  isActive: boolean;
  createdAt: Timestamp;
  driveLinks?: DriveLink[];
  [key: string]: any; // To accommodate various config fields
}

const botCategories: BotCategory[] = ['Ventas', 'Atención al Cliente', 'Asistente Personal', 'Agente Inmobiliario', 'Soporte Técnico'];

export default function BotsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [bots, setBots] = useState<BotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotCategory, setNewBotCategory] = useState<BotCategory>('Ventas');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<BotData | null>(null);

  const fetchBots = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const botsCollectionRef = collection(db, 'bots');
      const q = query(botsCollectionRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      // --- MIGRATION LOGIC for users with old bot config ---
      const hasBots = querySnapshot.docs.length > 0;
      if (!hasBots) {
        const qybotDocRef = doc(db, 'qybot', user.uid);
        const qybotDocSnap = await getDoc(qybotDocRef);
        
        // Check for a legacy field ('agentRole') and ensure a modern field ('activeBotId') is NOT present to prevent re-migration
        if (qybotDocSnap.exists() && qybotDocSnap.data().agentRole && !qybotDocSnap.data().activeBotId) {
          toast({ title: "Actualizando tu bot...", description: "Hemos encontrado tu configuración anterior y la estamos actualizando al nuevo formato multi-bot." });
          
          await migrateAndActivateLegacyBot(user.uid, qybotDocSnap.data());

          // Re-run the fetch to display the newly migrated bot
          const updatedQuerySnapshot = await getDocs(q);
          const fetchedBots = updatedQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BotData));
          setBots(fetchedBots);
          setIsLoading(false);
          return; // Exit after migration
        }
      }
      
      // --- REGULAR LOGIC ---
      const fetchedBots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BotData));
      setBots(fetchedBots);
    } catch (error) {
      console.error("Error fetching bots:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar tus bots.' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleToggleBotStatus = async (botToToggle: BotData, shouldBeActive: boolean) => {
    if (!user) return;
    setIsProcessing({ [botToToggle.id]: true });

    if (shouldBeActive) {
      // Activation Logic
      try {
        await activateBot(botToToggle);
        toast({ title: "Bot Activado", description: `El bot "${botToToggle.name}" ahora está activo.` });
        await fetchBots(); // Refresh the list to show the new state
      } catch (error) {
        console.error("Error activating bot:", error);
        toast({ variant: 'destructive', title: 'Error de Activación', description: 'No se pudo activar el bot.' });
      } finally {
        setIsProcessing({});
      }
    } else {
      // Deactivation Logic
      try {
        const batch = writeBatch(db);

        // Deactivate the bot
        const botRef = doc(db, 'bots', botToToggle.id);
        batch.update(botRef, { isActive: false });

        // Check if this was the active bot in the main config
        const qybotConfigRef = doc(db, 'qybot', user.uid);
        const qybotDocSnap = await getDoc(qybotConfigRef);

        if (qybotDocSnap.exists() && qybotDocSnap.data().activeBotId === botToToggle.id) {
          // It was the active bot, so clear the config to a safe default
          batch.set(qybotConfigRef, {
            activeBotId: null,
            promptXml: '<prompt><system>Ningún bot está activo. El sistema no responderá automáticamente.</system></prompt>',
            instanceIdAssociated: null,
          }, { merge: true });
        }

        await batch.commit();
        toast({ title: "Bot Desactivado", description: `El bot "${botToToggle.name}" ya no está activo.` });
        await fetchBots();
      } catch (error) {
        console.error("Error deactivating bot:", error);
        toast({ variant: 'destructive', title: 'Error de Desactivación', description: 'No se pudo desactivar el bot.' });
      } finally {
        setIsProcessing({});
      }
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBotName.trim()) {
        toast({ variant: "destructive", title: "Error", description: "El nombre del bot es obligatorio." });
        return;
    }
    setIsProcessing({ create: true });
    
    try {
        const newBotData = {
            userId: user.uid,
            name: newBotName,
            category: newBotCategory,
            isActive: false, // Bots are created inactive by default
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, 'bots'), newBotData);
        toast({ title: "Bot Creado", description: "Redirigiendo para configurar tu nuevo bot..." });
        
        setIsCreateDialogOpen(false);
        setNewBotName('');
        setNewBotCategory('Ventas');
        
        router.push(`/dashboard/bots/edit/${docRef.id}`);

    } catch (error) {
        console.error("Error creating bot:", error);
        toast({ variant: 'destructive', title: 'Error de Creación', description: 'No se pudo crear el nuevo bot.' });
    } finally {
        setIsProcessing({});
    }
  }

  const handleDeleteBot = (bot: BotData) => {
    if (bot.isActive) {
      toast({
        variant: "destructive",
        title: "Acción no permitida",
        description: "No puedes eliminar un bot que está activo. Desactívalo primero.",
      });
      return;
    }
    setBotToDelete(bot);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteBot = async () => {
    if (!botToDelete) return;
    setIsProcessing({ [botToDelete.id]: true });
    try {
      await deleteDoc(doc(db, 'bots', botToDelete.id));
      toast({ title: "Bot Eliminado", description: `El bot "${botToDelete.name}" ha sido eliminado.` });
      await fetchBots(); // Refresh list after deletion
    } catch (error) {
      console.error("Error deleting bot:", error);
      toast({ variant: 'destructive', title: 'Error de Eliminación', description: 'No se pudo eliminar el bot.' });
    } finally {
      setIsDeleteDialogOpen(false);
      setBotToDelete(null);
      setIsProcessing({});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BotIcon className="mr-3 h-8 w-8 text-primary" />
            Mis Asistentes Virtuales
          </h2>
          <p className="text-muted-foreground">Crea y gestiona diferentes bots para cada necesidad. Solo uno puede estar activo a la vez.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4 sm:mt-0">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Bot
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Bots</CardTitle>
          <CardDescription>Activa el bot que deseas usar o edita su configuración.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No has creado ningún bot. ¡Crea tu primer asistente!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Bot</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell className="font-medium">{bot.name}</TableCell>
                    <TableCell>{bot.category}</TableCell>
                    <TableCell>
                      <Switch
                        checked={bot.isActive}
                        onCheckedChange={(checked) => handleToggleBotStatus(bot, checked)}
                        disabled={isProcessing[bot.id]}
                        aria-label={`Activar o desactivar bot ${bot.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="outline" size="icon" onClick={() => router.push(`/dashboard/bots/edit/${bot.id}`)} title="Editar Bot">
                          <Edit className="h-4 w-4" />
                        </Button>
                       <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={() => handleDeleteBot(bot)} 
                          disabled={bot.isActive || isProcessing[bot.id]}
                          title={bot.isActive ? "Desactiva el bot para eliminarlo" : "Eliminar Bot"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Crear Nuevo Asistente Virtual</DialogTitle>
                <DialogDescription>
                    Elige un nombre y una categoría para tu nuevo bot. Podrás configurarlo en el siguiente paso.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateBot} className="space-y-4 py-4">
                <div>
                    <Label htmlFor="newBotName">Nombre del Bot</Label>
                    <Input 
                        id="newBotName"
                        value={newBotName}
                        onChange={(e) => setNewBotName(e.target.value)}
                        placeholder="Ej: Asistente de Ventas Nocturno"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="newBotCategory">Categoría</Label>
                    <Select
                        value={newBotCategory}
                        onValueChange={(value: BotCategory) => setNewBotCategory(value)}
                    >
                        <SelectTrigger id="newBotCategory">
                            <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            {botCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={isProcessing.create}>
                        {isProcessing.create && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear y Configurar
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este bot?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El bot "{botToDelete?.name}" y toda su configuración serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBotToDelete(null)} disabled={isProcessing[botToDelete?.id || '']}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteBot} 
              disabled={isProcessing[botToDelete?.id || '']} 
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing[botToDelete?.id || ''] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

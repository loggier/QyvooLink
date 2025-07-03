
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, writeBatch, Timestamp, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { buildPromptForBot } from '@/lib/bot-prompt-builder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bot, PlusCircle, Edit, Trash2, BotIcon } from 'lucide-react';
import { generateSafeId } from '@/lib/uuid';

export type BotCategory = 'Ventas' | 'Atención al Cliente' | 'Asistente Personal' | 'Agente Inmobiliario' | 'Soporte Técnico';

export interface BotData {
  id: string;
  userId: string;
  name: string;
  category: BotCategory;
  isActive: boolean;
  createdAt: Timestamp;
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

  const fetchBots = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const botsCollectionRef = collection(db, 'bots');
      const q = query(botsCollectionRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      // --- MIGRATION LOGIC for users with old bot config ---
      if (querySnapshot.empty) {
        const qybotDocRef = doc(db, 'qybot', user.uid);
        const qybotDocSnap = await getDoc(qybotDocRef);

        // Check for a legacy field like 'agentRole' to identify an un-migrated bot
        if (qybotDocSnap.exists() && qybotDocSnap.data().agentRole) {
          toast({ title: "Actualizando tu bot...", description: "Hemos encontrado tu configuración anterior y la estamos actualizando al nuevo formato multi-bot." });

          const legacyData = qybotDocSnap.data();
          const newBotData: Omit<BotData, 'id'> = {
              userId: user.uid,
              name: 'Bot de Ventas (Importado)',
              category: 'Ventas',
              isActive: true, // The old bot was always the active one
              createdAt: legacyData.createdAt instanceof Timestamp ? legacyData.createdAt : Timestamp.now(),
              // Copy all relevant fields from the old 'ventas' bot structure
              agentRole: legacyData.agentRole,
              selectedRules: legacyData.selectedRules || [],
              businessContext: legacyData.businessContext,
              serviceCatalog: legacyData.serviceCatalog || [],
              contact: legacyData.contact,
              closingMessage: legacyData.closingMessage,
              notificationPhoneNumber: legacyData.notificationPhoneNumber,
              notificationRule: legacyData.notificationRule,
          };

          // 1. Create the new bot in the 'bots' collection
          const newBotDocRef = await addDoc(collection(db, 'bots'), newBotData);
          
          // 2. Build the prompt for this new bot
          const botForPrompt = { id: newBotDocRef.id, ...newBotData };
          const { promptXml, instanceIdAssociated } = await buildPromptForBot(botForPrompt as BotData);

          // 3. Update the 'qybot' document to the new format (pointing to the active bot)
          await setDoc(qybotDocRef, {
              activeBotId: newBotDocRef.id,
              promptXml: promptXml,
              instanceIdAssociated,
          }, { merge: true });

          // 4. Re-run the fetch to display the newly migrated bot
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

  const handleActivateBot = async (botToActivateId: string) => {
    if (!user) return;
    setIsProcessing({ [botToActivateId]: true });
  
    const botToActivate = bots.find(b => b.id === botToActivateId);
    if (!botToActivate) {
      toast({ variant: "destructive", title: "Error", description: "Bot no encontrado." });
      setIsProcessing({});
      return;
    }
  
    try {
      const batch = writeBatch(db);
      
      // Deactivate all other bots for this user
      bots.forEach(bot => {
        if (bot.id !== botToActivateId) {
          const botRef = doc(db, 'bots', bot.id);
          batch.update(botRef, { isActive: false });
        }
      });
  
      // Activate the selected bot
      const activeBotRef = doc(db, 'bots', botToActivateId);
      batch.update(activeBotRef, { isActive: true });
      
      // Generate and save the active prompt config to the main 'qybot' document
      const { promptXml, instanceIdAssociated } = await buildPromptForBot(botToActivate);
      const qybotConfigRef = doc(db, 'qybot', user.uid);
      batch.set(qybotConfigRef, {
        activeBotId: botToActivateId,
        promptXml: promptXml,
        instanceIdAssociated: instanceIdAssociated, // Ensure this is stored
      }, { merge: true });

      await batch.commit();
      
      toast({ title: "Bot Activado", description: `El bot "${botToActivate.name}" ahora está activo.` });
      await fetchBots(); // Refresh the list to show the new state
    } catch (error) {
      console.error("Error activating bot:", error);
      toast({ variant: 'destructive', title: 'Error de Activación', description: 'No se pudo activar el bot.' });
    } finally {
      setIsProcessing({});
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
                        onCheckedChange={() => handleActivateBot(bot.id)}
                        disabled={isProcessing[bot.id] || bot.isActive}
                        aria-label={`Activar bot ${bot.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="outline" size="icon" onClick={() => router.push(`/dashboard/bots/edit/${bot.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                       {/*  <Button variant="destructive" size="icon" disabled>
                          <Trash2 className="h-4 w-4" />
                        </Button> */}
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
    </div>
  );
}

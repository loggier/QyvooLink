
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit3, Trash2, Tag, MessageSquareText, Zap } from 'lucide-react';

interface QuickReply {
  id: string;
  userId: string;
  tag: string;
  message: string;
  createdAt?: FirestoreTimestamp;
}

const initialFormState: Omit<QuickReply, 'id' | 'userId' | 'createdAt'> = {
  tag: '',
  message: '',
};

export default function QuickRepliesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [currentFormData, setCurrentFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<QuickReply | null>(null);

  const dataFetchUserId = user?.ownerId || user?.uid;

  const fetchQuickReplies = useCallback(async () => {
    if (!dataFetchUserId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'quickReplies'), where('userId', '==', dataFetchUserId));
      const querySnapshot = await getDocs(q);
      const fetchedReplies: QuickReply[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedReplies.push({ id: docSnap.id, ...(docSnap.data() as Omit<QuickReply, 'id'>) });
      });
      // Sort by tag or createdAt if available
      fetchedReplies.sort((a, b) => a.tag.localeCompare(b.tag));
      setQuickReplies(fetchedReplies);
    } catch (error) {
      console.error("Error fetching quick replies:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las respuestas rápidas." });
    } finally {
      setIsLoading(false);
    }
  }, [dataFetchUserId, toast]);

  useEffect(() => {
    fetchQuickReplies();
  }, [fetchQuickReplies]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenFormDialog = (reply: QuickReply | null = null) => {
    if (reply) {
      setEditingReply(reply);
      setCurrentFormData({ tag: reply.tag, message: reply.message });
    } else {
      setEditingReply(null);
      setCurrentFormData(initialFormState);
    }
    setIsFormOpen(true);
  };

  const handleCloseFormDialog = () => {
    setIsFormOpen(false);
    setEditingReply(null);
    setCurrentFormData(initialFormState);
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!dataFetchUserId || !currentFormData.tag.trim() || !currentFormData.message.trim()) {
      toast({ variant: "destructive", title: "Error de Validación", description: "El tag y el mensaje no pueden estar vacíos." });
      return;
    }
    setIsSaving(true);

    try {
      if (editingReply) {
        // Update existing reply
        const replyDocRef = doc(db, 'quickReplies', editingReply.id);
        await updateDoc(replyDocRef, {
          tag: currentFormData.tag,
          message: currentFormData.message,
        });
        toast({ title: "Respuesta Rápida Actualizada", description: "Los cambios han sido guardados." });
      } else {
        // Add new reply
        await addDoc(collection(db, 'quickReplies'), {
          userId: dataFetchUserId,
          tag: currentFormData.tag,
          message: currentFormData.message,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Respuesta Rápida Creada", description: "La nueva respuesta ha sido guardada." });
      }
      fetchQuickReplies();
      handleCloseFormDialog();
    } catch (error) {
      console.error("Error saving quick reply:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la respuesta rápida." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReply = (reply: QuickReply) => {
    setReplyToDelete(reply);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteReply = async () => {
    if (!replyToDelete) return;
    setIsSaving(true); // Reuse isSaving for delete operation as well
    try {
      await deleteDoc(doc(db, 'quickReplies', replyToDelete.id));
      toast({ title: "Respuesta Rápida Eliminada" });
      fetchQuickReplies();
      setIsDeleteDialogOpen(false);
      setReplyToDelete(null);
    } catch (error) {
      console.error("Error deleting quick reply:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la respuesta rápida." });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <Zap className="mr-3 h-8 w-8 text-primary" />
            Respuestas Rápidas
          </h2>
          <p className="text-muted-foreground">Gestiona tus plantillas de mensajes para agilizar tus conversaciones.</p>
        </div>
        <Button onClick={() => handleOpenFormDialog()} className="mt-4 sm:mt-0">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Respuesta Rápida
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Respuestas Rápidas</CardTitle>
          <CardDescription>Listado de tus respuestas predefinidas. Úsalas en tus chats para responder más eficientemente.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Cargando respuestas...</span>
            </div>
          ) : quickReplies.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No has creado ninguna respuesta rápida todavía. ¡Añade una!</p>
          ) : (
            <ScrollArea className="max-h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Tag (Atajo)</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quickReplies.map((reply) => (
                    <TableRow key={reply.id}>
                      <TableCell className="font-medium text-primary">{reply.tag}</TableCell>
                      <TableCell className="max-w-md truncate">{reply.message}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(reply)} title="Editar">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteReply(reply)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReply ? 'Editar Respuesta Rápida' : 'Añadir Nueva Respuesta Rápida'}</DialogTitle>
            <DialogDescription>
              {editingReply ? 'Modifica el tag o el mensaje de tu respuesta rápida.' : 'Crea un nuevo atajo y mensaje para usar en tus chats.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitForm} className="space-y-4 py-4">
            <div>
              <Label htmlFor="tag" className="flex items-center text-sm text-muted-foreground"><Tag className="h-3 w-3 mr-1.5"/>Tag (Atajo)</Label>
              <Input
                id="tag"
                name="tag"
                value={currentFormData.tag}
                onChange={handleInputChange}
                placeholder="Ej: !saludo, /despedida"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Este será el identificador corto para tu respuesta.</p>
            </div>
            <div>
              <Label htmlFor="message" className="flex items-center text-sm text-muted-foreground"><MessageSquareText className="h-3 w-3 mr-1.5"/>Mensaje Completo</Label>
              <Textarea
                id="message"
                name="message"
                value={currentFormData.message}
                onChange={handleInputChange}
                rows={5}
                placeholder="Escribe el texto completo de tu respuesta rápida aquí."
                required
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseFormDialog} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingReply ? 'Guardar Cambios' : 'Crear Respuesta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar esta respuesta rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La respuesta rápida con el tag "{replyToDelete?.tag}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReplyToDelete(null)} disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteReply} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

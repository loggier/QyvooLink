
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, addDoc, deleteDoc, orderBy, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, UserPlus, Edit3, Trash2, Building, Mail, Phone, UserCheck, Bot, UserRound, Briefcase, Star, MessageSquareDashed } from 'lucide-react';

interface ContactDetails {
  id: string; // Firestore document ID
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  tipoCliente?: 'Prospecto' | 'Cliente' | 'Proveedor' | 'Otro';
  chatbotEnabledForContact?: boolean;
  userId: string;
  _chatIdOriginal?: string; 
}

interface ContactStats {
  total: number;
  prospectos: number;
  clientes: number;
  proveedores: number;
  otros: number;
}

const initialContactFormState: Omit<ContactDetails, 'id' | 'userId'> = {
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  empresa: "",
  ubicacion: "",
  tipoCliente: 'Cliente',
  chatbotEnabledForContact: true,
  _chatIdOriginal: undefined,
};

export default function ContactsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [contacts, setContacts] = useState<ContactDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<ContactStats>({ total: 0, prospectos: 0, clientes: 0, proveedores: 0, otros: 0 });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  // editingContact state is removed as this dialog is only for adding.
  const [currentContactData, setCurrentContactData] = useState<Omit<ContactDetails, 'id' | 'userId'>>(initialContactFormState);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactDetails | null>(null);


  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'contacts'), where('userId', '==', user.uid), orderBy('nombre', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedContacts: ContactDetails[] = [];
      let prospectos = 0;
      let clientes = 0;
      let proveedores = 0;
      let otros = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<ContactDetails, 'id'>;
        fetchedContacts.push({ id: docSnap.id, ...data });
        switch (data.tipoCliente) {
          case 'Prospecto': prospectos++; break;
          case 'Cliente': clientes++; break;
          case 'Proveedor': proveedores++; break;
          case 'Otro': otros++; break;
        }
      });
      setContacts(fetchedContacts);
      setStats({ total: fetchedContacts.length, prospectos, clientes, proveedores, otros });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los contactos." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentContactData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setCurrentContactData(prev => ({ ...prev, tipoCliente: value as ContactDetails['tipoCliente'] }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setCurrentContactData(prev => ({ ...prev, chatbotEnabledForContact: checked }));
  };

  const handleAddNewContact = () => {
    setCurrentContactData({ ...initialContactFormState }); // Reset form for new contact
    setIsFormOpen(true);
  };
  
  const handleEditContact = (contact: ContactDetails) => {
    // Navigate to the dedicated contact detail page for editing
    router.push(`/dashboard/contacts/${contact.id}`);
  };

  const handleDeleteContact = (contact: ContactDetails) => {
    setContactToDelete(contact);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'contacts', contactToDelete.id));
      toast({ title: "Contacto Eliminado", description: "El contacto ha sido eliminado." });
      fetchContacts(); // Refresh list
      setIsDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el contacto." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return;
    }
    setIsSaving(true);
    
    const contactDataToSave: Omit<ContactDetails, 'id'> & { userId: string } = {
      ...currentContactData,
      userId: user.uid,
      chatbotEnabledForContact: currentContactData.chatbotEnabledForContact ?? true,
    };

    try {
      // This form is only for adding new contacts
      await addDoc(collection(db, 'contacts'), contactDataToSave);
      toast({ title: "Contacto Creado", description: "El nuevo contacto ha sido guardado." });
      
      setIsFormOpen(false);
      fetchContacts(); // Refresh list
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el contacto." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Contactos</h2>
          <p className="text-muted-foreground">Administra tu lista de contactos y su información.</p>
        </div>
        <Button onClick={handleAddNewContact} className="mt-4 sm:mt-0">
          <UserPlus className="mr-2 h-4 w-4" /> Añadir Nuevo Contacto
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contactos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospectos</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.prospectos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.clientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Otros (Proveedor/Etc)</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.proveedores + stats.otros}</div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contactos</CardTitle>
          <CardDescription>Visualiza y gestiona tus contactos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex items-center justify-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Cargando contactos...</span>
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No hay contactos para mostrar. ¡Añade uno nuevo!</p>
          ) : (
            <ScrollArea className="max-h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Chatbot</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.nombre || ""} {contact.apellido || ""}</TableCell>
                      <TableCell>{contact.empresa || "-"}</TableCell>
                      <TableCell>{contact.telefono || "-"}</TableCell>
                      <TableCell>{contact.email || "-"}</TableCell>
                      <TableCell>{contact.tipoCliente || "No definido"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${contact.chatbotEnabledForContact ?? true ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'}`}>
                          {contact.chatbotEnabledForContact ?? true ? "Activado" : "Desactivado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleEditContact(contact)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteContact(contact)}>
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

      {/* Contact Form Dialog - ONLY FOR ADDING NEW CONTACTS */}
      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
          setIsFormOpen(isOpen);
          if (!isOpen) {
            setCurrentContactData(initialContactFormState); // Reset form when dialog closes
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Contacto</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del nuevo contacto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitForm} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-3 w-3 mr-1.5"/>Nombre</Label>
                <Input id="nombre" name="nombre" value={currentContactData.nombre || ""} onChange={handleInputChange} placeholder="Juan"/>
              </div>
              <div>
                <Label htmlFor="apellido" className="flex items-center text-sm text-muted-foreground"><UserRound className="h-3 w-3 mr-1.5"/>Apellido</Label>
                <Input id="apellido" name="apellido" value={currentContactData.apellido || ""} onChange={handleInputChange} placeholder="Pérez"/>
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="flex items-center text-sm text-muted-foreground"><Mail className="h-3 w-3 mr-1.5"/>Correo Electrónico</Label>
              <Input id="email" name="email" type="email" value={currentContactData.email || ""} onChange={handleInputChange} placeholder="juan.perez@ejemplo.com"/>
            </div>
            <div>
              <Label htmlFor="telefono" className="flex items-center text-sm text-muted-foreground"><Phone className="h-3 w-3 mr-1.5"/>Teléfono</Label>
              <Input id="telefono" name="telefono" value={currentContactData.telefono || ""} onChange={handleInputChange} placeholder="+525512345678"/>
            </div>
            <div>
              <Label htmlFor="empresa" className="flex items-center text-sm text-muted-foreground"><Building className="h-3 w-3 mr-1.5"/>Empresa</Label>
              <Input id="empresa" name="empresa" value={currentContactData.empresa || ""} onChange={handleInputChange} placeholder="Tecnologías S.A."/>
            </div>
            <div>
              <Label htmlFor="ubicacion" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-3 w-3 mr-1.5"/>Ubicación</Label> {/* Consider changing icon if UserCheck is for Tipo Cliente */}
              <Input id="ubicacion" name="ubicacion" value={currentContactData.ubicacion || ""} onChange={handleInputChange} placeholder="Ciudad, País"/>
            </div>
            <div>
              <Label htmlFor="tipoCliente" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-3 w-3 mr-1.5"/>Tipo de Cliente</Label>
                <Select 
                  name="tipoCliente"
                  value={currentContactData.tipoCliente || ""} 
                  onValueChange={handleSelectChange}
                >
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
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                  id="chatbotEnabledForContact"
                  checked={currentContactData.chatbotEnabledForContact ?? true}
                  onCheckedChange={handleSwitchChange}
                  disabled={isSaving}
              />
              <Label htmlFor="chatbotEnabledForContact" className="flex items-center text-sm text-muted-foreground">
                <Bot className="h-4 w-4 mr-2" />
                Chatbot Activo para este Contacto
              </Label>
            </div>
            {!(currentContactData.chatbotEnabledForContact ?? true) && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 flex items-center">
                  <MessageSquareDashed className="h-3 w-3 mr-1" /> El bot no responderá automáticamente a este contacto.
              </p>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Crear Contacto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El contacto {contactToDelete?.nombre} {contactToDelete?.apellido} será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setContactToDelete(null)} disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteContact} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

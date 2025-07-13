
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, addDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, UserPlus, Edit3, Trash2, Building, Mail, Phone, UserCheck, Bot, UserRound, Briefcase, Star, MessageSquareDashed, ListTodo, ChevronLeft, ChevronRight, Search, FilterX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface ContactDetails {
  id: string; // Firestore document ID
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
  createdAt?: Timestamp;
}

interface ContactStats {
  total: number;
  prospectos: number;
  clientes: number;
  proveedores: number;
  otros: number;
}

const initialContactFormState: Omit<ContactDetails, 'id' | 'userId' | 'createdAt'> = {
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  empresa: "",
  ubicacion: "",
  tipoCliente: 'Cliente',
  estadoConversacion: 'Abierto',
  chatbotEnabledForContact: true,
  _chatIdOriginal: undefined,
};

const getInitials = (nombre?: string, apellido?: string) => {
    if (nombre && apellido) {
        return `${nombre[0]}${apellido[0]}`.toUpperCase();
    }
    if (nombre) {
        return nombre.substring(0, 2).toUpperCase();
    }
    return "NN";
}

export default function ContactsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const dataFetchUserId = user?.role === 'agent' ? user?.ownerId : user?.uid;

  const [contacts, setContacts] = useState<ContactDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<ContactStats>({ total: 0, prospectos: 0, clientes: 0, proveedores: 0, otros: 0 });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentContactData, setCurrentContactData] = useState<Omit<ContactDetails, 'id' | 'userId' | 'createdAt'>>(initialContactFormState);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactDetails | null>(null);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const fetchContacts = useCallback(async () => {
    if (!dataFetchUserId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'contacts'), where('userId', '==', dataFetchUserId));
      const querySnapshot = await getDocs(q);
      
      let prospectos = 0, clientes = 0, proveedores = 0, otros = 0;

      const fetchedContacts: ContactDetails[] = querySnapshot.docs.map((docSnap) => {
        try {
            const data = docSnap.data();
            const contact: ContactDetails = {
              id: docSnap.id,
              nombre: data.nombre || '',
              apellido: data.apellido || '',
              email: data.email || '',
              telefono: data.telefono || '',
              empresa: data.empresa || '',
              ubicacion: data.ubicacion || '',
              tipoCliente: data.tipoCliente,
              estadoConversacion: data.estadoConversacion || 'Abierto',
              chatbotEnabledForContact: data.chatbotEnabledForContact ?? true,
              userId: data.userId,
              _chatIdOriginal: data._chatIdOriginal,
              createdAt: data.createdAt,
            };
            
            switch (data.tipoCliente) {
              case 'Prospecto': prospectos++; break;
              case 'Cliente': clientes++; break;
              case 'Proveedor': proveedores++; break;
              case 'Otro': otros++; break;
            }
            return contact;
        } catch (e) {
            console.error(`Error processing contact document ${docSnap.id}:`, e);
            return null; // Return null for documents that cause an error
        }
      }).filter((contact): contact is ContactDetails => contact !== null); // Filter out any nulls
      
      setContacts(fetchedContacts);
      setStats({ total: fetchedContacts.length, prospectos, clientes, proveedores, otros });

    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los contactos." });
    } finally {
      setIsLoading(false);
    }
  }, [dataFetchUserId, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = useMemo(() => {
    return contacts
      .filter(contact => {
        const searchTermLower = searchTerm.toLowerCase();
        return (
          (contact.nombre?.toLowerCase() || '').includes(searchTermLower) ||
          (contact.apellido?.toLowerCase() || '').includes(searchTermLower) ||
          (contact.email?.toLowerCase() || '').includes(searchTermLower) ||
          (contact.empresa?.toLowerCase() || '').includes(searchTermLower)
        );
      })
      .filter(contact => typeFilter === 'all' || contact.tipoCliente === typeFilter)
      .filter(contact => statusFilter === 'all' || contact.estadoConversacion === statusFilter)
      .sort((a, b) => { // Sort after filtering
        const nameA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        const nameB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [contacts, searchTerm, typeFilter, statusFilter]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentContactData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: 'tipoCliente' | 'estadoConversacion', value: string) => {
    setCurrentContactData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setCurrentContactData(prev => ({ ...prev, chatbotEnabledForContact: checked }));
  };

  const handleAddNewContact = () => {
    setCurrentContactData({ ...initialContactFormState });
    setIsFormOpen(true);
  };
  
  const handleEditContact = (contact: ContactDetails) => {
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
      fetchContacts();
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
    if (!dataFetchUserId) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo identificar al propietario de la cuenta." });
      return;
    }
    setIsSaving(true);
    
    const contactDataToSave = {
      ...currentContactData,
      userId: dataFetchUserId,
      chatbotEnabledForContact: currentContactData.chatbotEnabledForContact ?? true,
      estadoConversacion: currentContactData.estadoConversacion ?? 'Abierto',
      createdAt: serverTimestamp(), // Ensure new contacts have a timestamp
    };

    try {
      await addDoc(collection(db, 'contacts'), contactDataToSave);
      toast({ title: "Contacto Creado", description: "El nuevo contacto ha sido guardado." });
      
      setIsFormOpen(false);
      fetchContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el contacto." });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status?: ContactDetails['estadoConversacion']) => {
    const statusText = status || 'Abierto';
    const variant = status === 'Cerrado' ? 'secondary' : status === 'Pendiente' ? 'destructive' : 'default';
    const className = status === 'Pendiente' ? 'bg-yellow-400 text-yellow-900' : 
                      status === 'Abierto' ? 'bg-green-500 text-white' : '';
    return <Badge variant={variant} className={cn(className, "text-xs")}>{statusText}</Badge>
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const lastContactIndex = currentPage * itemsPerPage;
  const firstContactIndex = lastContactIndex - itemsPerPage;
  const currentContacts = filteredContacts.slice(firstContactIndex, lastContactIndex);

  if (isLoading && !dataFetchUserId) {
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
          <p className="text-muted-foreground">Administra la lista de contactos de la organización.</p>
        </div>
        <Button onClick={handleAddNewContact} className="mt-4 sm:mt-0">
          <UserPlus className="mr-2 h-4 w-4" /> Añadir Nuevo Contacto
        </Button>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Filtrar y Buscar Contactos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Buscar por nombre, correo, empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="type-filter">Tipo de Cliente</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="type-filter">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="Prospecto">Prospecto</SelectItem>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Proveedor">Proveedor</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status-filter">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="Abierto">Abierto</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
            <Button variant="ghost" onClick={handleClearFilters}>
                <FilterX className="h-4 w-4 mr-2"/>
                Limpiar Filtros
            </Button>
        </CardFooter>
      </Card>


      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Cargando contactos...</span>
        </div>
      ) : currentContacts.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No se encontraron contactos que coincidan con tus filtros.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentContacts.map((contact) => (
            <Card key={contact.id} className="flex flex-col">
              <CardContent className="pt-6 flex-grow">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border">
                    <AvatarFallback>{getInitials(contact.nombre, contact.apellido)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold truncate">{contact.nombre || ""} {contact.apellido || ""}</h3>
                    <p className="text-sm text-muted-foreground truncate">{contact.empresa || "Sin empresa"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {contact.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{contact.telefono}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>
                 <div className="mt-4 flex flex-wrap gap-2">
                   {getStatusBadge(contact.estadoConversacion)}
                   <Badge variant={contact.chatbotEnabledForContact ?? true ? "secondary" : "outline"} className={cn(contact.chatbotEnabledForContact ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "")}>
                       <Bot className="h-3 w-3 mr-1"/> Chatbot {contact.chatbotEnabledForContact ?? true ? 'On' : 'Off'}
                   </Badge>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 bg-muted/50 p-2">
                 <Button variant="outline" size="sm" onClick={() => handleEditContact(contact)}>
                   <Edit3 className="h-4 w-4 mr-1" /> Editar
                 </Button>
                 {user?.role !== 'agent' && (
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteContact(contact)}>
                       <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                    </Button>
                 )}
              </CardFooter>
            </Card>
          ))}
        </div>
        {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-4 pt-4">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
        )}
       </>
      )}

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
          setIsFormOpen(isOpen);
          if (!isOpen) {
            setCurrentContactData(initialContactFormState);
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Contacto</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del nuevo contacto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitForm}>
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="space-y-4 py-4 pr-4">
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
                  <Label htmlFor="ubicacion" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-3 w-3 mr-1.5"/>Ubicación</Label>
                  <Input id="ubicacion" name="ubicacion" value={currentContactData.ubicacion || ""} onChange={handleInputChange} placeholder="Ciudad, País"/>
                </div>
                <div>
                  <Label htmlFor="tipoCliente" className="flex items-center text-sm text-muted-foreground"><UserCheck className="h-3 w-3 mr-1.5"/>Tipo de Cliente</Label>
                    <Select 
                      name="tipoCliente"
                      value={currentContactData.tipoCliente || ""} 
                      onValueChange={(value) => handleSelectChange('tipoCliente', value)}
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
                 <div>
                  <Label htmlFor="estadoConversacion" className="flex items-center text-sm text-muted-foreground"><ListTodo className="h-3 w-3 mr-1.5"/>Estado Conversación</Label>
                    <Select 
                      name="estadoConversacion"
                      value={currentContactData.estadoConversacion || "Abierto"} 
                      onValueChange={(value) => handleSelectChange('estadoConversacion', value)}
                    >
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
              </div>
            </ScrollArea>
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

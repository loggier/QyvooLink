
"use client";

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users2, UserPlus, Shield, UserCog, Edit, Trash2, MailX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { sendInvitationEmail } from '@/lib/email';
import { Switch } from '@/components/ui/switch';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface TeamMember {
  uid: string;
  fullName?: string;
  email?: string;
  role: 'owner' | 'admin' | 'agent';
  isActive: boolean;
}

interface Invitation {
    id: string;
    inviteeEmail: string;
    role: 'admin' | 'agent';
    createdAt: any;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamMember['role']>('agent');
  
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // State for invitations
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  

  const fetchData = useCallback(async () => {
    if (!user || !user.organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
      const invitationsQuery = query(
          collection(db, 'invitations'), 
          where('organizationId', '==', user.organizationId),
          where('status', '==', 'pending')
      );
      
      const [usersSnapshot, invitationsSnapshot] = await Promise.all([
          getDocs(usersQuery),
          getDocs(invitationsQuery)
      ]);

      const fetchedMembers: TeamMember[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMembers.push({
          uid: doc.id,
          fullName: data.fullName,
          email: data.email,
          role: data.role || 'agent',
          isActive: data.isActive ?? true,
        });
      });
      
      fetchedMembers.sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          if (a.role === 'admin' && b.role === 'agent') return -1;
          if (a.role === 'agent' && b.role === 'admin') return 1;
          return (a.fullName || '').localeCompare(b.fullName || '');
      });
      setMembers(fetchedMembers);

      const fetchedInvitations: Invitation[] = [];
      invitationsSnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedInvitations.push({
              id: doc.id,
              inviteeEmail: data.inviteeEmail,
              role: data.role,
              createdAt: data.createdAt?.toDate(),
          });
      });
      setInvitations(fetchedInvitations);

    } catch (error) {
      console.error("Error fetching team data:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos del equipo.' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openRoleDialog = (member: TeamMember) => {
    if (member.role === 'owner') {
        toast({
            variant: 'default',
            title: 'Acción no permitida',
            description: 'El rol del propietario de la organización no se puede cambiar.',
        });
        return;
    }
    setMemberToEdit(member);
    setSelectedRole(member.role);
    setIsRoleDialogOpen(true);
  };
  
  const handleUpdateRole = async () => {
      if (!memberToEdit) return;
      setIsProcessing({ [memberToEdit.uid]: true });
      try {
        const userDocRef = doc(db, 'users', memberToEdit.uid);
        await updateDoc(userDocRef, { role: selectedRole });
        toast({ title: "Rol Actualizado", description: `El rol de ${memberToEdit.fullName} ahora es ${selectedRole}.` });
        setIsRoleDialogOpen(false);
        await fetchData(); // Refresh the list
      } catch (error) {
        console.error("Error updating role:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el rol del miembro.' });
      } finally {
        setIsProcessing({});
      }
  };

  const handleToggleActiveStatus = async (member: TeamMember, newStatus: boolean) => {
    if (member.role === 'owner') {
        toast({ variant: 'default', title: 'Acción no permitida', description: 'No puedes desactivar al propietario de la organización.' });
        return;
    }
    setIsProcessing({ [member.uid]: true });
    try {
        const userDocRef = doc(db, 'users', member.uid);
        await updateDoc(userDocRef, { isActive: newStatus });
        toast({ title: "Estado Actualizado", description: `${member.fullName} ha sido ${newStatus ? 'activado' : 'desactivado'}.`});
        await fetchData();
    } catch (error) {
        console.error("Error toggling active status:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar el estado del miembro.' });
    } finally {
        setIsProcessing({});
    }
  };
  
  const handleRemoveMember = (member: TeamMember) => {
     if (member.role === 'owner') {
        toast({ variant: 'default', title: 'Acción no permitida', description: 'No puedes eliminar al propietario de la organización.' });
        return;
    }
    setMemberToRemove(member);
    setIsRemoveDialogOpen(true);
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsProcessing({ [memberToRemove.uid]: true });
    try {
        const userDocRef = doc(db, 'users', memberToRemove.uid);
        // Soft delete: remove from org and deactivate, but keep user record for history
        await updateDoc(userDocRef, {
            isActive: false,
            organizationId: null,
            role: null,
        });
        toast({ title: "Miembro Eliminado", description: `${memberToRemove.fullName} ha sido eliminado de la organización.`});
        setIsRemoveDialogOpen(false);
        await fetchData();
    } catch (error) {
        console.error("Error removing member:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar al miembro.' });
    } finally {
        setIsProcessing({});
    }
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.organizationId || !inviteEmail.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El correo electrónico es obligatorio.' });
      return;
    }
    
    setIsProcessing({ invite: true });
    try {
      // 1. Check if user with this email is already in the organization
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', inviteEmail.trim()), where('organizationId', '==', user.organizationId));
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Usuario existente',
          description: `${inviteEmail.trim()} ya es miembro de esta organización.`,
        });
        setIsProcessing({});
        return;
      }
      
      // 2. Check if there's a pending invitation for this email in this organization
      const invitationsRef = collection(db, 'invitations');
      const invQuery = query(invitationsRef, where('inviteeEmail', '==', inviteEmail.trim()), where('organizationId', '==', user.organizationId), where('status', '==', 'pending'));
      const invSnapshot = await getDocs(invQuery);

      if (!invSnapshot.empty) {
        toast({
          variant: 'default',
          title: 'Invitación pendiente',
          description: `Ya existe una invitación pendiente para este correo electrónico.`,
        });
        setIsProcessing({});
        return;
      }
      
      // 3. Create a new invitation document
      const organizationName = user.company || `${user.fullName}'s Team`;
      const newInvitationRef = await addDoc(invitationsRef, {
        organizationId: user.organizationId,
        organizationName: organizationName,
        inviterId: user.uid,
        inviterName: user.fullName || user.email,
        inviteeEmail: inviteEmail.trim(),
        role: inviteRole,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      // 4. Send the invitation email with the unique tokenized link
      await sendInvitationEmail({
        inviteeEmail: inviteEmail.trim(),
        organizationName: organizationName,
        inviterName: user.fullName || user.email || 'Un miembro del equipo',
        invitationId: newInvitationRef.id, // Pass the unique ID
      });

      toast({
        title: 'Invitación Enviada',
        description: `Se ha enviado una invitación a ${inviteEmail.trim()}.`,
      });
      
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('agent');
      await fetchData();

    } catch (error) {
      console.error("Error sending invitation:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la invitación.' });
    } finally {
      setIsProcessing({});
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setIsProcessing({ [invitationId]: true });
    try {
        await deleteDoc(doc(db, 'invitations', invitationId));
        toast({ title: 'Invitación Cancelada', description: 'La invitación ha sido eliminada.'});
        await fetchData();
    } catch(error) {
        console.error("Error cancelling invitation:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cancelar la invitación.' });
    } finally {
        setIsProcessing({});
    }
  };
  
  const getRoleBadge = (role: TeamMember['role']) => {
      switch(role) {
          case 'owner':
              return <Badge className="bg-amber-500 text-white hover:bg-amber-600"><Shield className="h-3 w-3 mr-1"/>Propietario</Badge>;
          case 'admin':
              return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"><Shield className="h-3 w-3 mr-1"/>Admin</Badge>;
          case 'agent':
              return <Badge variant="outline"><UserCog className="h-3 w-3 mr-1"/>Agente</Badge>;
          default:
              return <Badge variant="outline">{role}</Badge>
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <Users2 className="mr-3 h-8 w-8 text-primary" />
            Miembros del Equipo
          </h2>
          <p className="text-muted-foreground">Gestiona los miembros de tu organización y sus roles.</p>
        </div>
        {(user?.role === 'owner' || user?.role === 'admin') && (
           <Button onClick={() => setIsInviteDialogOpen(true)} className="mt-4 sm:mt-0">
             <UserPlus className="mr-2 h-4 w-4" /> Invitar Miembro
           </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Miembros Activos</CardTitle>
          <CardDescription>Estos son los usuarios que tienen acceso a este espacio de trabajo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.uid} className={!member.isActive ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <div className="font-medium">{member.fullName}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                        <div className="flex items-center space-x-2">
                         <Switch
                           checked={member.isActive}
                           onCheckedChange={(checked) => handleToggleActiveStatus(member, checked)}
                           disabled={isProcessing[member.uid] || member.role === 'owner'}
                           aria-label={`Activar o desactivar cuenta de ${member.fullName}`}
                         />
                         <Label htmlFor={`switch-${member.uid}`} className="text-xs">{member.isActive ? 'Activo' : 'Inactivo'}</Label>
                        </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {(user?.role === 'owner' || (user?.role === 'admin' && member.role !== 'owner')) && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openRoleDialog(member)} disabled={isProcessing[member.uid]}>
                            <Edit className="h-4 w-4 mr-2" />
                            Rol
                          </Button>
                           <Button variant="destructive" size="sm" onClick={() => handleRemoveMember(member)} disabled={isProcessing[member.uid] || member.role === 'owner'}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Pending Invitations Table */}
      {(user?.role === 'owner' || user?.role === 'admin') && invitations.length > 0 && (
          <Card>
              <CardHeader>
                  <CardTitle>Invitaciones Pendientes</CardTitle>
                  <CardDescription>Estas invitaciones han sido enviadas pero aún no han sido aceptadas.</CardDescription>
              </CardHeader>
              <CardContent>
                   <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Correo Electrónico</TableHead>
                              <TableHead>Rol Asignado</TableHead>
                              <TableHead>Enviada</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {invitations.map((inv) => (
                              <TableRow key={inv.id}>
                                  <TableCell className="font-medium">{inv.inviteeEmail}</TableCell>
                                  <TableCell>{getRoleBadge(inv.role)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                      {inv.createdAt ? formatDistanceToNow(inv.createdAt, { addSuffix: true, locale: es }) : 'Recientemente'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                      <Button variant="ghost" size="sm" onClick={() => handleCancelInvitation(inv.id)} disabled={isProcessing[inv.id]}>
                                          <MailX className="h-4 w-4 mr-2 text-destructive"/>
                                          Cancelar
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      )}

      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar Rol de {memberToEdit?.fullName}</DialogTitle>
            <DialogDescription>
              Selecciona un nuevo rol para este miembro del equipo. Los cambios se aplicarán inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="role-select">Rol del Usuario</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as TeamMember['role'])}>
                <SelectTrigger id="role-select">
                    <SelectValue placeholder="Seleccionar un rol" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="admin">Admin (Acceso a configuración y reportes)</SelectItem>
                    <SelectItem value="agent">Agente (Acceso limitado a chats y contactos)</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                Los Agentes pueden chatear con clientes. Los Admins pueden configurar bots y ver reportes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateRole} disabled={isProcessing[memberToEdit?.uid || '']}>
                {isProcessing[memberToEdit?.uid || ''] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar a este miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará a <strong>{memberToRemove?.fullName}</strong> de la organización. No podrán acceder a este espacio de trabajo. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemove(null)} disabled={isProcessing[memberToRemove?.uid || '']}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveMember} className="bg-destructive hover:bg-destructive/90" disabled={isProcessing[memberToRemove?.uid || '']}>
               {isProcessing[memberToRemove?.uid || ''] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
               Eliminar Miembro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invitation Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Nuevo Miembro</DialogTitle>
            <DialogDescription>
              Ingresa el correo electrónico y asigna un rol al nuevo miembro. Recibirá una notificación para unirse a tu organización.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Correo Electrónico del Invitado</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="nuevo.miembro@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Asignar Rol</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as 'admin' | 'agent')}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Seleccionar un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agente (Acceso limitado a chats y contactos)</SelectItem>
                  <SelectItem value="admin">Admin (Acceso a configuración y reportes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)} disabled={isProcessing.invite}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isProcessing.invite}>
                {isProcessing.invite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

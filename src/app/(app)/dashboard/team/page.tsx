
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users2, UserPlus, Shield, UserCog, Edit } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TeamMember {
  uid: string;
  fullName?: string;
  email?: string;
  role: 'owner' | 'admin' | 'agent';
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamMember['role']>('agent');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const fetchTeamMembers = useCallback(async () => {
    if (!user || !user.organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
      const querySnapshot = await getDocs(q);
      const fetchedMembers: TeamMember[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMembers.push({
          uid: doc.id,
          fullName: data.fullName,
          email: data.email,
          role: data.role || 'agent',
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
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los miembros del equipo.' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const openRoleDialog = (member: TeamMember) => {
    setMemberToEdit(member);
    setSelectedRole(member.role);
    setIsRoleDialogOpen(true);
  };
  
  const handleUpdateRole = async () => {
      if (!memberToEdit) return;
      setIsSavingRole(true);
      try {
        const userDocRef = doc(db, 'users', memberToEdit.uid);
        await updateDoc(userDocRef, { role: selectedRole });
        toast({ title: "Rol Actualizado", description: `El rol de ${memberToEdit.fullName} ahora es ${selectedRole}.` });
        setIsRoleDialogOpen(false);
        await fetchTeamMembers(); // Refresh the list
      } catch (error) {
        console.error("Error updating role:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el rol del miembro.' });
      } finally {
        setIsSavingRole(false);
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button onClick={() => {}} className="mt-4 sm:mt-0" disabled>
                  <UserPlus className="mr-2 h-4 w-4" /> Invitar Miembro
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>La función para invitar miembros estará disponible pronto.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Miembros</CardTitle>
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
                  <TableHead>Correo Electrónico</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.uid}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell className="text-right">
                      {(user?.role === 'owner' && member.uid !== user.uid) && (
                        <Button variant="outline" size="sm" onClick={() => openRoleDialog(member)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Gestionar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
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
                    <SelectItem value="admin">Admin (Acceso total)</SelectItem>
                    <SelectItem value="agent">Agente (Acceso limitado)</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                Los Agentes pueden chatear con clientes. Los Admins pueden configurar bots y ver reportes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateRole} disabled={isSavingRole}>
                {isSavingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

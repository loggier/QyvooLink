
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Wifi, Bot, Users, MessagesSquare, CalendarDays } from 'lucide-react';

interface AdminViewUser {
  uid: string;
  fullName?: string;
  email?: string;
  createdAt?: Timestamp;
  isActive: boolean;
  instanceStatus?: 'Conectado' | 'Desconectado' | 'Pendiente' | 'No Configurada';
  botConfigured: boolean;
  instanceName?: string;
  contactCount: number;
  totalMessages: number;
  botMessages: number;
}

interface DashboardStats {
  totalUsers: number;
  activeInstances: number;
  totalMessages: number;
  configuredBots: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminViewUser[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [selectedUserForDateChange, setSelectedUserForDateChange] = useState<AdminViewUser | null>(null);
  const [newRegistrationDate, setNewRegistrationDate] = useState<Date | undefined>(undefined);
  const [isSavingDate, setIsSavingDate] = useState(false);

  const fetchAllUsersData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const usersQuerySnapshot = await getDocs(collection(db, 'users'));
      const allUserDataPromises = usersQuerySnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const uid = userDoc.id;

        // --- Fetch Additional Data ---
        let instanceName: string | undefined = undefined;
        let instanceStatus: AdminViewUser['instanceStatus'] = 'No Configurada';
        let contactCount = 0;
        let totalMessages = 0;
        let botMessages = 0;

        // Fetch instance data
        const instanceDocRef = doc(db, 'instances', uid);
        const instanceDocSnap = await getDoc(instanceDocRef);
        if (instanceDocSnap.exists()) {
          const instanceData = instanceDocSnap.data();
          instanceStatus = instanceData.status || 'Pendiente';
          instanceName = instanceData.name;
          const instanceId = instanceData.id || instanceData.name;

          // Fetch message counts if instanceId exists
          if (instanceId) {
            try {
              const messagesQuery = query(collection(db, 'chat'), where('instanceId', '==', instanceId));
              const messagesSnapshot = await getDocs(messagesQuery);
              totalMessages = messagesSnapshot.size;
              messagesSnapshot.forEach(msgDoc => {
                if (msgDoc.data().user_name?.toLowerCase() === 'bot') {
                  botMessages++;
                }
              });
            } catch (e) {
              console.error(`Error fetching chat data for instance ${instanceId}`, e);
            }
          }
        }

        // Fetch contact count
        try {
          const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', uid));
          const contactsSnapshot = await getDocs(contactsQuery);
          contactCount = contactsSnapshot.size;
        } catch (e) {
          console.error(`Error fetching contact count for user ${uid}`, e);
        }

        // Fetch bot config data
        const botDocRef = doc(db, 'qybot', uid);
        const botDocSnap = await getDoc(botDocRef);
        const botConfigured = botDocSnap.exists() && !!botDocSnap.data().promptXml;

        return {
          uid,
          fullName: userData.fullName || 'N/A',
          email: userData.email,
          createdAt: userData.createdAt,
          isActive: userData.isActive ?? true,
          instanceStatus,
          botConfigured,
          instanceName,
          contactCount,
          totalMessages,
          botMessages,
        };
      });
      
      const allUserData = await Promise.all(allUserDataPromises);
      // Filter out the current admin user from the list
      const filteredUsers = allUserData.filter(u => u.uid !== user.uid);
      
      setUsers(filteredUsers);
      
      // Calculate aggregate stats
      const totalUsers = filteredUsers.length;
      const activeInstances = filteredUsers.filter(u => u.instanceStatus === 'Conectado').length;
      const totalMessages = filteredUsers.reduce((sum, u) => sum + u.totalMessages, 0);
      const configuredBots = filteredUsers.filter(u => u.botConfigured).length;

      setStats({
        totalUsers,
        activeInstances,
        totalMessages,
        configuredBots,
      });

    } catch (error) {
      console.error("Error fetching users data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los datos de los usuarios.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAllUsersData();
  }, [fetchAllUsersData]);

  const handleToggleUserStatus = async (uid: string, currentStatus: boolean) => {
    const userToUpdate = users.find(u => u.uid === uid);
    if (!userToUpdate) return;

    // Optimistically update the UI
    setUsers(prevUsers =>
      prevUsers.map(u =>
        u.uid === uid ? { ...u, isActive: !currentStatus } : u
      )
    );

    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, { isActive: !currentStatus });
      toast({
        title: "Estado Actualizado",
        description: `La cuenta de ${userToUpdate.email} ha sido ${!currentStatus ? 'activada' : 'desactivada'}.`,
      });
    } catch (error) {
      // Revert UI change on error
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.uid === uid ? { ...u, isActive: currentStatus } : u
        )
      );
      console.error("Error updating user status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado del usuario.",
      });
    }
  };

  const handleOpenDateDialog = (userToEdit: AdminViewUser) => {
    setSelectedUserForDateChange(userToEdit);
    setNewRegistrationDate(userToEdit.createdAt ? userToEdit.createdAt.toDate() : new Date());
    setIsDateDialogOpen(true);
  };
  
  const handleUpdateRegistrationDate = async () => {
    if (!selectedUserForDateChange || !newRegistrationDate) {
      toast({ variant: "destructive", title: "Error", description: "No se ha seleccionado un usuario o una fecha." });
      return;
    }
    setIsSavingDate(true);
    try {
      const userDocRef = doc(db, 'users', selectedUserForDateChange.uid);
      await updateDoc(userDocRef, {
        createdAt: Timestamp.fromDate(newRegistrationDate),
      });
      toast({
        title: "Fecha Actualizada",
        description: `La fecha de registro de ${selectedUserForDateChange.email} ha sido actualizada.`,
      });
      setIsDateDialogOpen(false);
      fetchAllUsersData(); // Refresh data in the table
    } catch (error) {
      console.error("Error updating registration date:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la fecha de registro." });
    } finally {
      setIsSavingDate(false);
    }
  };
  
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const getInstanceStatusBadge = (status?: AdminViewUser['instanceStatus']) => {
    switch (status) {
      case 'Conectado':
        return <Badge className="bg-green-500 text-white"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'Desconectado':
        return <Badge variant="destructive"><Wifi className="h-3 w-3 mr-1" />Desconectado</Badge>;
      case 'Pendiente':
        return <Badge variant="secondary"><Wifi className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="outline">No Configurada</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4">Cargando datos de administrador...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Shield className="mr-3 h-8 w-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Panel de Administración</h2>
          <p className="text-muted-foreground">Visión general y gestión de la plataforma Qyvoo.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
            <p className="text-xs text-muted-foreground">Cuentas registradas en la plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instancias Activas</CardTitle>
            <Wifi className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeInstances ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
            <p className="text-xs text-muted-foreground">Instancias en estado "Conectado"</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes Totales</CardTitle>
            <MessagesSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMessages.toLocaleString('es-ES') ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
            <p className="text-xs text-muted-foreground">Procesados en toda la plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bots Configurados</CardTitle>
            <Bot className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.configuredBots ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
            <p className="text-xs text-muted-foreground">Usuarios con un prompt de bot activo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas de Usuario</CardTitle>
          <CardDescription>
            Activa/desactiva cuentas, visualiza el estado de sus servicios y gestiona fechas de registro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estadísticas de la Instancia</TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell>
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-sm text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-muted-foreground mt-1">Registrado: {formatDate(u.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <div className="font-semibold text-sm">{u.instanceName || 'Sin Nombre'}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                           <Users className="h-3 w-3" /> Contactos: <span className="font-bold">{u.contactCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                           <MessagesSquare className="h-3 w-3" /> Msjs Totales: <span className="font-bold">{u.totalMessages}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                           <Bot className="h-3 w-3" /> Msjs del Bot: <span className="font-bold">{u.botMessages}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-2 items-start">
                          {getInstanceStatusBadge(u.instanceStatus)}
                          {u.botConfigured ? (
                          <Badge className="bg-blue-500 text-white"><Bot className="h-3 w-3 mr-1"/>Bot Configurado</Badge>
                          ) : (
                          <Badge variant="outline"><Bot className="h-3 w-3 mr-1"/>Bot Pendiente</Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                       <Switch
                        checked={u.isActive}
                        onCheckedChange={() => handleToggleUserStatus(u.uid, u.isActive)}
                        aria-label={`Activar o desactivar la cuenta de ${u.email}`}
                      />
                      <Button variant="outline" size="icon" onClick={() => handleOpenDateDialog(u)} title="Cambiar fecha de registro">
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar Fecha de Registro</DialogTitle>
            <DialogDescription>
              Selecciona la nueva fecha de registro para el usuario {selectedUserForDateChange?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Calendar
                mode="single"
                selected={newRegistrationDate}
                onSelect={setNewRegistrationDate}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
             />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDateDialogOpen(false)} disabled={isSavingDate}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRegistrationDate} disabled={isSavingDate || !newRegistrationDate}>
              {isSavingDate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Fecha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

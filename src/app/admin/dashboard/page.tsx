
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Wifi, Bot, Users, MessagesSquare } from 'lucide-react';

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

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminViewUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-6 w-6 text-primary" />
            Panel de Administración de Usuarios
          </CardTitle>
          <CardDescription>
            Gestiona usuarios, visualiza el estado de sus servicios y activa o desactiva cuentas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estadísticas de la Instancia</TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead className="text-right">Cuenta Activa</TableHead>
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
                    <TableCell className="text-right">
                       <Switch
                        checked={u.isActive}
                        onCheckedChange={() => handleToggleUserStatus(u.uid, u.isActive)}
                        aria-label={`Activar o desactivar la cuenta de ${u.email}`}
                      />
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
    </div>
  );
}

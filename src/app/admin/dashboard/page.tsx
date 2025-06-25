
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Wifi, Bot, CheckCircle, XCircle } from 'lucide-react';

// Combined interface for displaying user data in the admin panel
interface AdminViewUser {
  uid: string;
  fullName?: string;
  email?: string;
  createdAt?: Timestamp;
  isActive: boolean;
  instanceStatus?: 'Conectado' | 'Desconectado' | 'Pendiente' | 'No Configurada';
  botConfigured: boolean;
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
      const allUserData = await Promise.all(
        usersQuerySnapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          const uid = userDoc.id;

          // Fetch instance data
          const instanceDocRef = doc(db, 'instances', uid);
          const instanceDocSnap = await getDoc(instanceDocRef);
          let instanceStatus: AdminViewUser['instanceStatus'] = 'No Configurada';
          if (instanceDocSnap.exists()) {
            instanceStatus = instanceDocSnap.data().status || 'Pendiente';
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
          };
        })
      );

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
                <TableHead>Fecha de Registro</TableHead>
                <TableHead>Instancia</TableHead>
                <TableHead>Bot</TableHead>
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
                    </TableCell>
                    <TableCell>{formatDate(u.createdAt)}</TableCell>
                    <TableCell>{getInstanceStatusBadge(u.instanceStatus)}</TableCell>
                    <TableCell>
                      {u.botConfigured ? (
                        <Badge className="bg-blue-500 text-white"><Bot className="h-3 w-3 mr-1"/>Configurado</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
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

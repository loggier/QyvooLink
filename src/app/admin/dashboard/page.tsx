
"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp, query, where, collectionGroup, limit } from 'firebase/firestore';
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
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Wifi, Bot, Users, MessagesSquare, CalendarDays, TrendingUp, ShieldCheck, Clock, XCircle, Star, AlertCircle, Save } from 'lucide-react';
import { differenceInDays, formatDistanceToNow } from 'fns';
import { es } from 'date-fns/locale';

interface SubscriptionDetails {
  planName: string;
  status: 'active' | 'trialing' | 'canceled' | string;
  renewsOn: Date | null;
  isTrial: boolean;
  trialEndsInDays?: number;
  willCancel: boolean;
}

interface AdminViewUser {
  uid: string;
  fullName?: string;
  email?: string;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
  isActive: boolean;
  isVip?: boolean;
  vipInstanceLimit?: number; // New field for instance limit
  instanceStatus?: 'Conectado' | 'Desconectado' | 'Pendiente' | 'No Configurada';
  botConfigured: boolean;
  instanceName?: string;
  contactCount: number | 'N/A';
  totalMessages: number | 'N/A';
  botMessages: number | 'N/A';
  subscription?: SubscriptionDetails | null;
}

interface DashboardStats {
  totalUsers: number;
  activeInstances: number;
  totalMessages: number | 'N/A';
  configuredBots: number;
  activeSubscriptions: number;
  estimatedMRR: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminViewUser[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [selectedUserForDateChange, setSelectedUserForDateChange] = useState<AdminViewUser | null>(null);
  const [newRegistrationDate, setNewRegistrationDate] = useState<Date | undefined>(new Date());
  const [isSavingDate, setIsSavingDate] = useState(false);
  
  const [isSavingLimit, setIsSavingLimit] = useState<Record<string, boolean>>({});

  const fetchAllUsersData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [usersQuerySnapshot, plansSnapshot, allSubscriptionsSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'subscriptions')),
        getDocs(query(collectionGroup(db, 'subscriptions'), where('status', 'in', ['active', 'trialing'])))
      ]);

      const plansMap = new Map<string, any>();
      plansSnapshot.forEach(doc => plansMap.set(doc.id, { ...doc.data(), id: doc.id }));

      let estimatedMRR = 0;
      allSubscriptionsSnapshot.forEach(subDoc => {
          const sub = subDoc.data();
          const plan = plansMap.get(sub.planId);
          if (plan) {
              if (plan.monthlyPriceId === sub.priceId) {
                  estimatedMRR += plan.priceMonthly || 0;
              } else if (plan.yearlyPriceId === sub.priceId) {
                  estimatedMRR += (plan.priceYearly || 0) / 12;
              }
          }
      });
      
      const allUserDataPromises = usersQuerySnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const uid = userDoc.id;

        const [instanceDocSnap, botDocSnap, userSubscriptionsSnapshot] = await Promise.all([
          getDoc(doc(db, 'instances', uid)),
          getDoc(doc(db, 'qybot', uid)),
          getDocs(query(collection(db, 'users', uid, 'subscriptions'), where('status', 'in', ['active', 'trialing']), limit(1)))
        ]);

        let instanceStatus: AdminViewUser['instanceStatus'] = 'No Configurada';
        let instanceName: string | undefined;

        if (instanceDocSnap.exists()) {
          const instanceData = instanceDocSnap.data();
          instanceStatus = instanceData.status || 'Pendiente';
          instanceName = instanceData.name;
        }
        
        let subscriptionData: SubscriptionDetails | null = null;
        if (!userSubscriptionsSnapshot.empty) {
            const sub = userSubscriptionsSnapshot.docs[0].data();
            const plan = plansMap.get(sub.planId);
            if (plan) {
                const renewsOn = sub.current_period_end?.toDate() ?? null;
                let trialEndsInDays;
                if (sub.status === 'trialing' && renewsOn) {
                    trialEndsInDays = differenceInDays(renewsOn, new Date());
                }
                subscriptionData = {
                    planName: plan.name,
                    status: sub.status,
                    renewsOn: renewsOn,
                    isTrial: sub.status === 'trialing',
                    trialEndsInDays: trialEndsInDays,
                    willCancel: sub.cancel_at_period_end,
                };
            }
        }
        
        return {
          uid,
          fullName: userData.fullName || 'N/A',
          email: userData.email,
          createdAt: userData.createdAt,
          lastLogin: userData.lastLogin,
          isActive: userData.isActive ?? true,
          isVip: userData.isVip ?? false,
          vipInstanceLimit: userData.vipInstanceLimit || 1, // Default to 1 if VIP
          instanceStatus,
          botConfigured: botDocSnap.exists() && !!botDocSnap.data().promptXml,
          instanceName,
          contactCount: 'N/A',
          totalMessages: 'N/A',
          botMessages: 'N/A',
          subscription: subscriptionData,
        };
      });
      
      const allUserData = await Promise.all(allUserDataPromises);
      const filteredUsers = allUserData.filter(u => u.uid !== user.uid);
      
      setUsers(filteredUsers);
      
      const configuredBots = filteredUsers.filter(u => u.botConfigured).length;
      const activeInstances = filteredUsers.filter(u => u.instanceStatus === 'Conectado').length;

      setStats({
        totalUsers: filteredUsers.length,
        activeInstances,
        totalMessages: 'N/A',
        configuredBots,
        activeSubscriptions: allSubscriptionsSnapshot.size,
        estimatedMRR: estimatedMRR,
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
  
  const handleToggleStatus = async (uid: string, field: 'isActive' | 'isVip', currentValue: boolean) => {
    const userToUpdate = users.find(u => u.uid === uid);
    if (!userToUpdate) return;
  
    setUsers(prevUsers =>
      prevUsers.map(u =>
        u.uid === uid ? { ...u, [field]: !currentValue } : u
      )
    );
  
    try {
      await updateDoc(doc(db, 'users', uid), { [field]: !currentValue });
      const fieldName = field === 'isActive' ? 'Estado' : 'Acceso VIP';
      const action = !currentValue ? 'activado' : 'desactivado';
      toast({
        title: `${fieldName} Actualizado`,
        description: `El ${fieldName.toLowerCase()} de ${userToUpdate.email} ha sido ${action}.`,
      });
    } catch (error) {
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.uid === uid ? { ...u, [field]: currentValue } : u
        )
      );
      console.error(`Error updating user ${field}:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `No se pudo actualizar el ${field.toLowerCase()} del usuario.`,
      });
    }
  };

  const handleInstanceLimitChange = (uid: string, value: string) => {
    const limit = parseInt(value, 10);
    setUsers(prevUsers =>
      prevUsers.map(u =>
        u.uid === uid ? { ...u, vipInstanceLimit: isNaN(limit) ? 0 : limit } : u
      )
    );
  };
  
  const handleSaveInstanceLimit = async (uid: string) => {
      const userToUpdate = users.find(u => u.uid === uid);
      if (!userToUpdate || typeof userToUpdate.vipInstanceLimit !== 'number') return;
  
      setIsSavingLimit(prev => ({ ...prev, [uid]: true }));
      try {
          await updateDoc(doc(db, 'users', uid), { vipInstanceLimit: userToUpdate.vipInstanceLimit });
          toast({
              title: "Límite Actualizado",
              description: `El límite de instancias para ${userToUpdate.email} ha sido guardado.`
          });
      } catch (error) {
          console.error("Error saving instance limit:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el límite de instancias." });
      } finally {
          setIsSavingLimit(prev => ({ ...prev, [uid]: false }));
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
      await updateDoc(doc(db, 'users', selectedUserForDateChange.uid), {
        createdAt: Timestamp.fromDate(newRegistrationDate),
      });
      toast({
        title: "Fecha Actualizada",
        description: `La fecha de registro de ${selectedUserForDateChange.email} ha sido actualizada.`,
      });
      setIsDateDialogOpen(false);
      fetchAllUsersData(); 
    } catch (error) {
      console.error("Error updating registration date:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la fecha de registro." });
    } finally {
      setIsSavingDate(false);
    }
  };
  
  const formatDate = (date?: Date | Timestamp | null) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Timestamp ? date.toDate() : date;
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1971) {
        return 'N/A';
    }
    return dateObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatRelativeDate = (date?: Date | Timestamp | null) => {
    if (!date) return 'Nunca';
    const dateObj = date instanceof Timestamp ? date.toDate() : date;
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1971) {
        return 'Fecha inválida';
    }
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instancias Activas</CardTitle>
            <Wifi className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeInstances ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes Totales</CardTitle>
             <AlertCircle className="h-5 w-5 text-amber-500" title="Este cálculo ha sido desactivado para optimizar el rendimiento. Se debe implementar un sistema de agregación."/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMessages.toLocaleString('es-ES') ?? 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bots Configurados</CardTitle>
            <Bot className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.configuredBots ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
            <ShieldCheck className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSubscriptions ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Estimado</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.estimatedMRR.toFixed(2) ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas de Usuario</CardTitle>
          <CardDescription>
            Activa/desactiva cuentas, visualiza el estado de sus servicios y gestiona fechas de registro. Las estadísticas de mensajes se deben consultar en reportes para optimizar costos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead>Estadísticas (Agregadas)</TableHead>
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
                      <div className="text-xs text-muted-foreground mt-1">
                        <p>Reg: {formatDate(u.createdAt)}</p>
                        <p>Último login: {formatRelativeDate(u.lastLogin)}</p>
                      </div>
                    </TableCell>
                     <TableCell>
                        {u.subscription ? (
                            <div className="flex flex-col space-y-1 text-xs">
                                <Badge className={`w-fit ${u.subscription.status === 'active' ? 'bg-green-500' : 'bg-yellow-400'} text-white`}>
                                   {u.subscription.planName}
                                </Badge>
                                {u.subscription.isTrial ? (
                                    <span className="flex items-center text-yellow-600"><Clock className="h-3 w-3 mr-1"/>Prueba finaliza en {u.subscription.trialEndsInDays} días</span>
                                ) : (
                                    <span className="flex items-center text-muted-foreground"><CalendarDays className="h-3 w-3 mr-1"/>Renueva el {formatDate(u.subscription.renewsOn)}</span>
                                )}
                                {u.subscription.willCancel && <Badge variant="destructive" className="w-fit"><XCircle className="h-3 w-3 mr-1"/>Cancelación programada</Badge>}
                            </div>
                        ) : u.isVip ? (
                            <Badge className="bg-amber-400 text-amber-900"><Star className="h-3 w-3 mr-1"/>Acceso VIP</Badge>
                        ) : (
                            <Badge variant="outline">Sin Suscripción</Badge>
                        )}
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
                     <TableCell>
                      <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
                        <span><Users className="h-3 w-3 inline mr-1"/> {u.contactCount} Contactos</span>
                        <span><MessagesSquare className="h-3 w-3 inline mr-1"/> {u.totalMessages} Mensajes</span>
                        <span><Bot className="h-3 w-3 inline mr-1"/> {u.botMessages} del Bot</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-y-2">
                       <div className="flex items-center justify-end space-x-2">
                         <span className="text-xs text-muted-foreground">Activo</span>
                         <Switch
                           checked={u.isActive}
                           onCheckedChange={() => handleToggleStatus(u.uid, 'isActive', u.isActive)}
                           aria-label={`Activar o desactivar la cuenta de ${u.email}`}
                         />
                       </div>
                       <div className="flex items-center justify-end space-x-2">
                          <span className="text-xs text-muted-foreground">VIP</span>
                          <Switch
                            checked={u.isVip ?? false}
                            onCheckedChange={() => handleToggleStatus(u.uid, 'isVip', u.isVip ?? false)}
                            aria-label={`Activar o desactivar el acceso VIP para ${u.email}`}
                           />
                       </div>
                        {u.isVip && (
                            <div className="flex items-center justify-end space-x-1 mt-1">
                                <Input
                                    type="number"
                                    className="h-7 w-16 text-xs"
                                    placeholder="Límite"
                                    value={u.vipInstanceLimit || ''}
                                    onChange={(e) => handleInstanceLimitChange(u.uid, e.target.value)}
                                    min="1"
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveInstanceLimit(u.uid)} disabled={isSavingLimit[u.uid]}>
                                    {isSavingLimit[u.uid] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                </Button>
                            </div>
                        )}
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

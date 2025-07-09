
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users2, UserPlus, Shield, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
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
          role: data.role || 'agent', // Default to 'agent' if role is not set
        });
      });
      // Ensure owner is always first
      fetchedMembers.sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
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
  
  const getRoleBadge = (role: TeamMember['role']) => {
      switch(role) {
          case 'owner':
              return <Badge className="bg-amber-500 text-white"><Shield className="h-3 w-3 mr-1"/>Propietario</Badge>;
          case 'admin':
              return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1"/>Admin</Badge>;
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
        <Button onClick={() => toast({ title: "Próximamente", description: "La función para invitar miembros estará disponible pronto."})} className="mt-4 sm:mt-0" disabled>
          <UserPlus className="mr-2 h-4 w-4" /> Invitar Miembro
        </Button>
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
                      {/* Placeholder for future actions */}
                      <Button variant="ghost" size="sm" disabled>...</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

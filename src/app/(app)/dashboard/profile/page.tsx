
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserCircle, Building, Phone, Mail, User } from 'lucide-react';

interface UserProfileData {
  fullName?: string;
  company?: string;
  phone?: string;
  email?: string; // Will be read-only from auth
  username?: string; // Will be read-only from auth
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UserProfileData>({
    fullName: '',
    company: '',
    phone: '',
    email: '',
    username: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const dbData = userDocSnap.data();
          setFormData({
            fullName: dbData.fullName || '',
            company: dbData.company || '',
            phone: dbData.phone || '',
            email: user.email || '', // From auth context
            username: dbData.username || '', // Username from DB, as it was set during registration
          });
        } else {
          // Fallback if somehow user doc doesn't exist but auth user does
          setFormData({
            email: user.email || '',
            username: user.username || '', // username might be directly on user object if fetched differently
          });
          toast({ variant: "destructive", title: "Error", description: "No se encontraron datos de perfil detallados." });
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el perfil." });
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading) {
        // If auth is not loading and user is null, stop loading.
        setIsLoading(false);
    }
  }, [user, toast, authLoading]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Debes estar autenticado." });
      return;
    }
    setIsSaving(true);

    const dataToSave: Partial<UserProfileData> = {
      fullName: formData.fullName,
      company: formData.company,
      phone: formData.phone,
      // email and username are not saved back from here as they are read-only or managed elsewhere
    };

    try {
      await setDoc(doc(db, 'users', user.uid), dataToSave, { merge: true });
      toast({ title: "Perfil Actualizado", description: "Tu información ha sido guardada." });
      // Optionally, re-fetch user from AuthContext if it holds a stale copy of these fields
      // or update AuthContext's user state directly if it's designed to be mutable.
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el perfil." });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Cargando perfil...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>No estás autenticado o no se pudo cargar el perfil.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <UserCircle className="mr-3 h-7 w-7 text-primary" />
            Tu Perfil
          </CardTitle>
          <CardDescription>
            Administra la información de tu cuenta. El correo electrónico y el nombre de usuario no son editables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Nombre Completo</Label>
              <Input 
                id="fullName" 
                name="fullName" 
                value={formData.fullName || ''} 
                onChange={handleInputChange} 
                placeholder="Tu nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground"/>Empresa</Label>
              <Input 
                id="company" 
                name="company" 
                value={formData.company || ''} 
                onChange={handleInputChange} 
                placeholder="Nombre de tu empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Teléfono</Label>
              <Input 
                id="phone" 
                name="phone" 
                value={formData.phone || ''} 
                onChange={handleInputChange} 
                placeholder="Tu número de teléfono"
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Correo Electrónico (No editable)</Label>
              <Input 
                id="email" 
                name="email" 
                value={formData.email || ''} 
                readOnly 
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Nombre de Usuario (No editable)</Label>
              <Input 
                id="username" 
                name="username" 
                value={formData.username || ''} 
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="pt-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSaving || authLoading || isLoading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

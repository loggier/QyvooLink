
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserCircle, Building, Phone, Mail, User, MapPin, Globe, Briefcase, Users } from 'lucide-react';

interface UserProfileData {
  fullName?: string;
  company?: string;
  phone?: string;
  email?: string; 
  username?: string; 
  country?: string;
  city?: string;
  sector?: string;
  employeeCount?: string;
}

const sectorOptions = [
  "Tecnología", "Salud", "Educación", "Finanzas", "Retail", 
  "Manufactura", "Servicios Profesionales", "Consultoría", "Marketing/Publicidad", 
  "Bienes Raíces", "Construcción", "Gobierno", "Otro"
];

const employeeCountOptions = [
  "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
];

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UserProfileData>({
    fullName: '',
    company: '',
    phone: '',
    email: '',
    username: '',
    country: '',
    city: '',
    sector: '',
    employeeCount: '',
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
          const dbData = userDocSnap.data() as UserProfileData; // Cast to include new fields
          setFormData({
            fullName: dbData.fullName || '',
            company: dbData.company || '',
            phone: dbData.phone || '',
            email: user.email || '', 
            username: user.username || dbData.username || '', 
            country: dbData.country || '',
            city: dbData.city || '',
            sector: dbData.sector || '',
            employeeCount: dbData.employeeCount || '',
          });
        } else {
          setFormData(prev => ({
            ...prev,
            email: user.email || '',
            username: user.username || '', 
          }));
          toast({ variant: "default", title: "Perfil Parcial", description: "Completa tu información de perfil." });
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el perfil." });
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading) {
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

  const handleSelectChange = (name: keyof UserProfileData, value: string) => {
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
      country: formData.country,
      city: formData.city,
      sector: formData.sector,
      employeeCount: formData.employeeCount,
      // email and username are not saved back from here
    };

    try {
      await setDoc(doc(db, 'users', user.uid), dataToSave, { merge: true });
      toast({ title: "Perfil Actualizado", description: "Tu información ha sido guardada." });
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
              <Label htmlFor="country" className="flex items-center"><Globe className="mr-2 h-4 w-4 text-muted-foreground"/>País</Label>
              <Input 
                id="country" 
                name="country" 
                value={formData.country || ''} 
                onChange={handleInputChange} 
                placeholder="País de residencia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground"/>Ciudad</Label>
              <Input 
                id="city" 
                name="city" 
                value={formData.city || ''} 
                onChange={handleInputChange} 
                placeholder="Ciudad de residencia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector" className="flex items-center"><Briefcase className="mr-2 h-4 w-4 text-muted-foreground"/>Sector</Label>
              <Select name="sector" value={formData.sector || ""} onValueChange={(value) => handleSelectChange('sector', value)}>
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Selecciona tu sector" />
                </SelectTrigger>
                <SelectContent>
                  {sectorOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeCount" className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground"/>Número de Empleados</Label>
              <Select name="employeeCount" value={formData.employeeCount || ""} onValueChange={(value) => handleSelectChange('employeeCount', value)}>
                <SelectTrigger id="employeeCount">
                  <SelectValue placeholder="Selecciona rango de empleados" />
                </SelectTrigger>
                <SelectContent>
                  {employeeCountOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

    
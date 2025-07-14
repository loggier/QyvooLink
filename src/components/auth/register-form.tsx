
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, Building, Mail } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ReCAPTCHA from 'react-google-recaptcha';

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const registerSchema = z.object({
  fullName: z.string().min(2, { message: "El nombre completo debe tener al menos 2 caracteres." }),
  company: z.string().min(2, { message: "El nombre de la empresa debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phone: z.string().regex(phoneRegex, { message: "Número de teléfono inválido."}),
  username: z.string().min(3, { message: "El nombre de usuario debe tener al menos 3 caracteres." }).regex(/^[a-zA-Z0-9_.-]+$/, { message: "El nombre de usuario no puede contener espacios ni caracteres especiales." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, { message: "Debes aceptar los términos y condiciones." }),
  recaptchaToken: z.string().min(1, { message: "Por favor, completa el CAPTCHA." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInvitation, setIsInvitation] = useState(false);
  const [invitationOrgName, setInvitationOrgName] = useState('');
  
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const searchParams = useSearchParams();
  const invitationId = searchParams.get('invitationId');

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      company: "",
      email: "",
      phone: "",
      username: "",
      password: "",
      confirmPassword: "",
      terms: false,
      recaptchaToken: "",
    },
  });

  const { registerUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInvitationDetails = async () => {
      if (invitationId) {
        setIsLoading(true);
        try {
          const invDocRef = doc(db, 'invitations', invitationId);
          const invDocSnap = await getDoc(invDocRef);
          if (invDocSnap.exists() && invDocSnap.data().status === 'pending') {
            const invData = invDocSnap.data();
            form.setValue('email', invData.inviteeEmail);
            form.setValue('company', invData.organizationName); // Set company name from invitation
            setIsInvitation(true);
            setInvitationOrgName(invData.organizationName);
          } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Invitación no válida o ya utilizada.' });
          }
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo verificar la invitación.' });
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchInvitationDetails();
  }, [invitationId, form, toast]);


  async function onSubmit(values: RegisterFormData) {
    setIsLoading(true);
    try {
      await registerUser(values, invitationId);
      toast({
        title: "Registro Exitoso",
        description: isInvitation 
          ? `¡Bienvenido a ${invitationOrgName}! Ya puedes colaborar con tu equipo.`
          : "¡Bienvenido a Qyvoo! Ahora elige un plan para comenzar.",
      });
      // Redirect is handled by AuthContext and the registerUser function
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falló el Registro",
        description: error.message || "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
      });
      recaptchaRef.current?.reset();
      form.setValue('recaptchaToken', '');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      {isInvitation && (
        <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 text-sm text-primary">
          <p>Estás aceptando una invitación para unirte a la organización:</p>
          <p className="font-semibold">{invitationOrgName}</p>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isInvitation ? (
          <>
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Building className="h-4 w-4 mr-2 text-muted-foreground"/>Empresa (de la invitación)</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly disabled className="bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Mail className="h-4 w-4 mr-2 text-muted-foreground"/>Correo Electrónico (de la invitación)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} readOnly disabled className="bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Teléfono</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+1234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de Usuario</FormLabel>
              <FormControl>
                <Input placeholder="tuusuario" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar Contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Acepto los <Link href="/terms" className="text-primary hover:underline" target="_blank">Términos y Condiciones</Link> y la <Link href="/privacy" className="text-primary hover:underline" target="_blank">Política de Privacidad</Link>.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recaptchaToken"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                  onChange={(token) => field.onChange(token || "")}
                  onExpired={() => field.onChange("")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isInvitation ? 'Unirme a la Organización' : 'Crear Cuenta'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Iniciar Sesión
          </Link>
        </p>
      </form>
    </Form>
  );
}

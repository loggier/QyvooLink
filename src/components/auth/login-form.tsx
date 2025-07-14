
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
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { verifyRecaptcha } from '@/lib/recaptcha';


const loginSchema = z.object({
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  password: z.string().min(1, { message: "La contraseña es obligatoria." }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { loginUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // This check runs only on the client side
    if (typeof window !== 'undefined') {
      setIsProduction(window.location.hostname === 'admin.qyvoo.com');
    }
  }, []);

  async function onSubmit(values: LoginFormData) {
    setIsLoading(true);
    
    if (isProduction) {
        const token = recaptchaRef.current?.getValue();
        if (!token) {
            toast({
                variant: "destructive",
                title: "Verificación Requerida",
                description: "Por favor, completa el CAPTCHA.",
            });
            setIsLoading(false);
            return;
        }
        
        const isRecaptchaValid = await verifyRecaptcha(token);
        recaptchaRef.current?.reset();
        
        if (!isRecaptchaValid) {
            toast({
                variant: "destructive",
                title: "Verificación Fallida",
                description: "No se pudo verificar el CAPTCHA. Inténtalo de nuevo.",
            });
            setIsLoading(false);
            return;
        }
    }

    try {
      await loginUser(values);
      toast({
        title: "Inicio de Sesión Exitoso",
        description: "¡Bienvenido de nuevo a Qyvoo!",
      });
      // Redirect is handled by AuthContext
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falló el Inicio de Sesión",
        description: error.message || "Correo electrónico o contraseña inválidos. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
               <div className="flex items-center justify-between">
                <FormLabel>Contraseña</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isProduction && (
            <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
            />
        )}
        <Button type="submit" className="w-full" disabled={isLoading}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Iniciar Sesión
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
    </Form>
  );
}

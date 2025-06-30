
"use client";

import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/dashboard/app-shell';
import { Loader2 } from 'lucide-react';

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // No hacer nada mientras carga
    }

    if (!user) {
      router.replace('/login');
      return;
    }
    
    // El admin siempre tiene acceso a todo
    if (user.role === 'admin') {
      return;
    }

    // Comprobar si tiene suscripción activa O si tiene el modo VIP activado
    const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
    const isVip = user.isVip === true;
    const isAllowed = hasActiveSubscription || isVip;
    
    // Lista de rutas permitidas sin acceso completo
    const allowedPaths = ['/subscribe', '/profile', '/dashboard/configuration'];

    // Si no tiene acceso y no está en una de las páginas permitidas, redirigir a /subscribe
    if (!isAllowed && !allowedPaths.some(p => pathname.startsWith(p))) {
      router.replace('/subscribe');
    }

  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Prevenir renderizado del layout para usuarios no permitidos que no estén en páginas de escape
  const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
  const isVip = user.isVip === true;
  const isAllowed = user.role === 'admin' || hasActiveSubscription || isVip;
  
  if (!isAllowed && !['/subscribe', '/profile', '/dashboard/configuration'].some(p => pathname.startsWith(p))) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-2">Redirigiendo a la página de suscripción...</p>
        </div>
      );
  }

  return <AppShell>{children}</AppShell>;
}

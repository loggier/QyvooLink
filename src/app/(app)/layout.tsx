
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
    
    // Si el usuario es admin, puede acceder a todo
    if (user.role === 'admin') {
      return;
    }

    // Comprobar si tiene suscripción activa
    const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
    
    // Lista de rutas permitidas sin suscripción activa
    const allowedPaths = ['/subscribe', '/profile'];

    // Si no tiene suscripción y no está en una de las páginas permitidas, redirigir a /subscribe
    if (!hasActiveSubscription && !allowedPaths.some(p => pathname.startsWith(p))) {
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

  // Prevenir renderizado del layout para usuarios no suscritos y no admins que no estén en páginas permitidas
  if (user.role !== 'admin' && !(user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') && !pathname.startsWith('/subscribe') && !pathname.startsWith('/profile')) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-2">Redirigiendo a la página de suscripción...</p>
        </div>
      );
  }

  return <AppShell>{children}</AppShell>;
}

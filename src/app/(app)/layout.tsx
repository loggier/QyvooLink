
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
    
    // --- Subscription check (for non-admins) ---
    if (user.role !== 'admin') {
      const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
      const isVip = user.isVip === true;
      const isAllowed = hasActiveSubscription || isVip;
      
      const allowedPathsWithoutSub = ['/subscribe', '/dashboard/profile'];

      if (!isAllowed && !allowedPathsWithoutSub.some(p => pathname.startsWith(p))) {
        router.replace('/subscribe');
        return; 
      }
    }

    // --- Role-based access control (for agents) ---
    if (user.role === 'agent') {
      const agentRestrictedPaths = [
        '/dashboard/bots',
        '/dashboard/configuration',
        '/dashboard/reports',
        '/dashboard/team',
      ];

      if (agentRestrictedPaths.some(p => pathname.startsWith(p))) {
        router.replace('/dashboard');
        return;
      }
    }

  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Prevent render flicker while redirecting
  if (user.role === 'agent') {
    const agentRestrictedPaths = [
      '/dashboard/bots',
      '/dashboard/configuration',
      '/dashboard/reports',
      '/dashboard/team',
    ];
    if (agentRestrictedPaths.some(p => pathname.startsWith(p))) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )
    }
  }


  return <AppShell>{children}</AppShell>;
}

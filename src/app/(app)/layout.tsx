
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
    
    // --- Subscription check (only for owners and managers) ---
    if (user.role === 'owner' || user.role === 'manager') {
      const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
      const isVip = user.isVip === true;
      const isAllowed = hasActiveSubscription || isVip;
      
      const allowedPathsWithoutSub = ['/subscribe', '/dashboard/profile'];

      // Managers don't see the subscribe page, so we redirect them to a waiting page if sub is inactive
      if (user.role === 'manager' && !isAllowed) {
          // You can create a dedicated page for this state, for now, we redirect to dashboard
          // where they won't be able to do much.
          console.log("Manager's subscription is not active. Limited access.");
      }
      
      if (user.role === 'owner' && !isAllowed && !allowedPathsWithoutSub.some(p => pathname.startsWith(p))) {
        router.replace('/subscribe');
        return; 
      }
    }

    // --- Role-based access control ---
    if (user.role === 'agent') {
      const agentRestrictedPaths = [
        '/dashboard/bots',
        '/dashboard/configuration',
        '/dashboard/reports',
        '/dashboard/team',
        '/dashboard/subscriptions', // Assuming a future page
      ];

      if (agentRestrictedPaths.some(p => pathname.startsWith(p))) {
        router.replace('/dashboard');
        return;
      }
    }
    
    if (user.role === 'manager') {
       const managerRestrictedPaths = [
         '/dashboard/team', // Managers shouldn't see the team/instances of the owner
         '/subscribe', // Managers don't handle subscriptions
       ];
       if (managerRestrictedPaths.some(p => pathname.startsWith(p))) {
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
  const isRedirecting = () => {
      if (!user) return true; // Will be redirected to login
      if (user.role === 'agent') {
          const agentRestrictedPaths = ['/dashboard/bots', '/dashboard/configuration', '/dashboard/reports', '/dashboard/team'];
          return agentRestrictedPaths.some(p => pathname.startsWith(p));
      }
      if (user.role === 'manager') {
          const managerRestrictedPaths = ['/dashboard/team', '/subscribe'];
          return managerRestrictedPaths.some(p => pathname.startsWith(p));
      }
      if (user.role === 'owner') {
          const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
          const isVip = user.isVip === true;
          const allowedPathsWithoutSub = ['/subscribe', '/dashboard/profile'];
          return !hasActiveSubscription && !isVip && !allowedPathsWithoutSub.some(p => pathname.startsWith(p));
      }
      return false;
  };

  if (isRedirecting()) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }


  return <AppShell>{children}</AppShell>;
}

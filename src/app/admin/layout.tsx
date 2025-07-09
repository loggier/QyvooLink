
"use client";

import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/dashboard/app-shell';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // The global admin section should ONLY be accessible to users with the 'admin' role.
      // Organization 'owners' should not have access to this section.
      const isAllowed = user?.role === 'admin';
      if (!user || !isAllowed) {
        router.replace('/dashboard'); // Redirect non-admins
      }
    }
  }, [user, loading, router]);

  const isAllowed = user?.role === 'admin';
  if (loading || !user || !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

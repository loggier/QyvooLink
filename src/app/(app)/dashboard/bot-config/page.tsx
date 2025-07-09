
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * This page is obsolete and has been replaced by the flow in `/dashboard/bots`.
 * This component acts as a redirect to maintain compatibility with any old links or bookmarks.
 */
export default function ObsoleteBotConfigPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/bots');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-muted-foreground">Redirigiendo a la nueva página de gestión de bots...</p>
    </div>
  );
}

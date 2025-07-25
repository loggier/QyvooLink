
"use client";

import type { ReactNode } from 'react';
import { EvolveLinkLogo } from '@/components/icons';
import Link from 'next/link';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Qyvoo Home">
            <EvolveLinkLogo className="h-12 w-auto text-primary mb-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-md sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

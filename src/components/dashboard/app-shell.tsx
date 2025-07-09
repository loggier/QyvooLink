
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

import { EvolveLinkLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AppFooter } from '@/components/layout/footer';
import OnboardingGuide from '@/components/dashboard/onboarding-guide';
import {
  Home, Settings, BarChart2, LogOut, UserCircle, MessageSquare, Bot, Contact, Zap, Shield, CreditCard, HelpCircle, PanelLeft, Users2,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  restrictedTo?: ('owner' | 'admin')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Panel', shortLabel: 'Panel', icon: Home },
  { href: '/dashboard/chat', label: 'Chat', shortLabel: 'Chat', icon: MessageSquare },
  { href: '/dashboard/bots', label: 'Mis Bots', shortLabel: 'Bots', icon: Bot, restrictedTo: ['owner', 'admin'] },
  { href: '/dashboard/contacts', label: 'Contactos', shortLabel: 'Contactos', icon: Contact },
  { href: '/dashboard/team', label: 'Equipo', shortLabel: 'Equipo', icon: Users2, restrictedTo: ['owner', 'admin'] },
  { href: '/dashboard/quick-replies', label: 'Respuestas', shortLabel: 'Respuestas', icon: Zap },
  { href: '/dashboard/configuration', label: 'Configuración', shortLabel: 'Config', icon: Settings, restrictedTo: ['owner', 'admin'] },
  { href: '/dashboard/reports', label: 'Reportes', shortLabel: 'Reportes', icon: BarChart2, restrictedTo: ['owner', 'admin'] },
  { href: '/admin/dashboard', label: 'Admin Panel', shortLabel: 'Admin', icon: Shield, adminOnly: true },
  { href: '/admin/subscriptions', label: 'Planes', shortLabel: 'Planes', icon: CreditCard, adminOnly: true },
];

const getInitials = (name?: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logoutUser } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.onboardingCompleted === false && pathname === '/dashboard') {
      setIsGuideOpen(true);
    }
  }, [user, pathname]);

  const userRole = user?.role;
  const visibleNavItems = navItems.filter(item => {
    // Hide global admin links from anyone who isn't a global 'admin'
    if (item.adminOnly && userRole !== 'admin') {
      return false;
    }
    // Hide org-restricted links from users not in the allowed roles (e.g., 'agent')
    if (item.restrictedTo && !item.restrictedTo.includes(userRole as 'owner' | 'admin')) {
      return false;
    }
    return true;
  });

  const homeUrl = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';

  const NavLink = ({ item, isMobile }: { item: NavItem, isMobile?: boolean }) => {
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    return (
      <Link
        href={item.href}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
          ${isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }
          ${isMobile ? 'text-base py-3' : ''}
        `}
      >
        <item.icon className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
        {isMobile ? item.label : item.shortLabel}
      </Link>
    );
  };
  
  return (
    <>
      <OnboardingGuide isOpen={isGuideOpen} setIsOpen={setIsGuideOpen} startFromBeginning={true} />
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur-sm">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link href={homeUrl} className="flex items-center gap-2" aria-label="Dashboard">
                <EvolveLinkLogo className="h-8 w-auto text-primary" data-ai-hint="company logo" />
                <span className="hidden sm:inline text-xl font-semibold text-primary">Qyvoo</span>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {visibleNavItems.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full group">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                            {getInitials(user.fullName || user.username)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.fullName || user.username}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <UserCircle className="mr-2 h-4 w-4" />
                        Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsGuideOpen(true)} className="cursor-pointer">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Ver Guía de Inicio
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logoutUser} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mobile Navigation Trigger */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <PanelLeft className="h-6 w-6" />
                    <span className="sr-only">Abrir menú</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-4">
                   <Link href={homeUrl} className="flex items-center gap-2 mb-6" aria-label="Dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <EvolveLinkLogo className="h-8 w-auto text-primary" data-ai-hint="company logo" />
                      <span className="text-xl font-semibold text-primary">Qyvoo</span>
                  </Link>
                  <nav className="flex flex-col gap-2">
                    {visibleNavItems.map((item) => (
                      <NavLink key={item.href} item={item} isMobile />
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
          </div>
        </main>
        <AppFooter />
      </div>
    </>
  );
}

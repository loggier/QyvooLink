
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AppFooter } from '@/components/layout/footer';
import OnboardingGuide from '@/components/dashboard/onboarding-guide';
import {
  Home, Settings, BarChart2, LogOut, UserCircle, MessageSquare, Bot, Contact2, Zap, Shield, CreditCard, HelpCircle, PanelLeft, Users2, Briefcase, Folder, Calendar, LogIn, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  items: (NavItem & { restrictedTo?: ('owner' | 'admin' | 'manager')[] })[];
  restrictedTo?: ('owner' | 'admin' | 'manager')[];
  adminOnly?: boolean;
}

const navStructure: (NavItem | NavGroup)[] = [
  { href: '/dashboard', label: 'Panel', icon: Home },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/schedule', label: 'Agenda', icon: Calendar },
  {
    title: 'Clientes',
    shortTitle: 'Clientes',
    icon: Folder,
    items: [
      { href: '/dashboard/contacts', label: 'Contactos', icon: Contact2 },
      { href: '/dashboard/quick-replies', label: 'Respuestas', icon: Zap },
    ]
  },
  {
    title: 'Administración',
    shortTitle: 'Admin',
    icon: Briefcase,
    restrictedTo: ['owner', 'admin', 'manager'],
    items: [
      { href: '/dashboard/bots', label: 'Mis Bots', icon: Bot },
      { href: '/dashboard/team', label: 'Equipo', icon: Users2, restrictedTo: ['owner', 'admin'] },
      { href: '/dashboard/configuration', label: 'Configuración', icon: Settings },
      { href: '/dashboard/reports', label: 'Reportes', icon: BarChart2 },
    ]
  },
  {
    title: 'Plataforma',
    shortTitle: 'Plataforma',
    icon: Shield,
    adminOnly: true,
    items: [
      { href: '/admin/dashboard', label: 'Admin Panel', icon: Shield },
      { href: '/admin/subscriptions', label: 'Planes', icon: CreditCard },
    ]
  }
];

const getInitials = (name?: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const isGroup = (item: NavItem | NavGroup): item is NavGroup => 'title' in item;

function ImpersonationBar() {
  const { impersonation, stopImpersonation } = useAuth();
  if (!impersonation.active) {
    return null;
  }
  return (
    <div className="bg-yellow-400 text-yellow-900 text-center text-sm py-2 px-4 flex items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4" />
        <span>
          Estás viendo como <strong>{impersonation.impersonatedUserEmail}</strong>.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1 text-yellow-900 hover:bg-yellow-500 hover:text-yellow-900"
        onClick={stopImpersonation}
      >
        <X className="h-4 w-4 mr-1"/>
        Volver al Admin
      </Button>
    </div>
  );
}


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
  const homeUrl = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';

  const visibleNavStructure = navStructure.map(item => {
    if (isGroup(item)) {
      if (item.adminOnly && userRole !== 'admin') return null;
      if (item.restrictedTo && !item.restrictedTo.includes(userRole as 'owner' | 'admin' | 'manager')) return null;
      
      const visibleItems = item.items.filter(subItem => {
        if (subItem.restrictedTo && !subItem.restrictedTo.includes(userRole as 'owner' | 'admin' | 'manager')) {
          return false;
        }
        return true;
      });

      if (visibleItems.length === 0) return null;
      return { ...item, items: visibleItems };
    }
    return item;
  }).filter(Boolean) as (NavItem | NavGroup)[];
  
  const activeGroupTitle = (visibleNavStructure.find(item => 
    isGroup(item) && item.items.some(subItem => pathname.startsWith(subItem.href))
  ) as NavGroup)?.title;

  const NavLink = ({ href, label, icon: Icon, className = '' }: NavItem & { className?: string }) => {
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={cn(`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors`,
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          className
        )}
      >
        <Icon className="h-5 w-5 mr-3" />
        {label}
      </Link>
    );
  };
  
  return (
    <>
      <OnboardingGuide isOpen={isGuideOpen} setIsOpen={setIsGuideOpen} startFromBeginning={true} />
      <div className="flex flex-col min-h-screen bg-background">
        <ImpersonationBar />
        <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur-sm">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link href={homeUrl} className="flex items-center gap-2" aria-label="Dashboard">
                <EvolveLinkLogo className="h-8 w-auto text-primary" data-ai-hint="company logo" />
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xl font-semibold text-primary">Qyvoo</span>
                  <Badge variant="secondary" className="px-1.5 py-0.5 text-xs font-normal">
                    Beta
                  </Badge>
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {visibleNavStructure.map((item) => {
                  if (isGroup(item)) {
                    const isGroupActive = item.items.some(subItem => pathname.startsWith(subItem.href));
                    return (
                      <DropdownMenu key={item.title}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className={cn(
                            'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                            isGroupActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}>
                             <item.icon className="h-5 w-5 mr-2" />
                             {item.shortTitle}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {item.items.map(subItem => (
                            <DropdownMenuItem key={subItem.href} asChild>
                              <Link href={subItem.href} className="flex items-center w-full">
                                <subItem.icon className="h-4 w-4 mr-2"/>
                                {subItem.label}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                     <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }
                        `}
                      >
                        <item.icon className="h-5 w-5 mr-2" />
                        {item.label}
                      </Link>
                  )
                })}
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
                <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                   <div className="p-4 border-b">
                      <Link href={homeUrl} className="flex items-center gap-2" aria-label="Dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                        <EvolveLinkLogo className="h-8 w-auto text-primary" data-ai-hint="company logo" />
                        <div className="flex items-center gap-2">
                           <span className="text-xl font-semibold text-primary">Qyvoo</span>
                           <Badge variant="secondary" className="px-1.5 py-0.5 text-xs font-normal">
                             Beta
                           </Badge>
                        </div>
                      </Link>
                   </div>
                  <nav className="flex-grow p-4">
                    <Accordion type="single" collapsible className="w-full space-y-1" defaultValue={activeGroupTitle}>
                       {visibleNavStructure.map((item) => {
                          if (!isGroup(item)) {
                            return <NavLink key={item.href} {...item} />
                          }
                          return (
                            <AccordionItem value={item.title} key={item.title} className="border-b-0">
                                <AccordionTrigger className={cn(
                                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:no-underline"
                                )}>
                                    <item.icon className="h-5 w-5 mr-3" />
                                    {item.title}
                                </AccordionTrigger>
                                <AccordionContent className="pl-6 space-y-1 mt-1">
                                    {item.items.map(subItem => <NavLink key={subItem.href} {...subItem} />)}
                                </AccordionContent>
                            </AccordionItem>
                          )
                       })}
                    </Accordion>
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

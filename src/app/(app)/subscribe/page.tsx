
"use client";

import SubscriptionManager from '@/components/dashboard/subscriptions-display';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from '@/context/auth-context';
import { Bot, Sparkles } from 'lucide-react';

export default function SubscribePage() {
    const { user } = useAuth();
    return (
        <div className="container mx-auto max-w-4xl py-8">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <Sparkles className="mx-auto h-12 w-12 text-primary mb-4" />
                    <CardTitle className="text-3xl font-bold">¡Bienvenido, {user?.fullName || user?.username}!</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground pt-2">
                        Para desbloquear todo el potencial de Qyvoo, necesitas una suscripción activa.
                        <br/>
                        Elige el plan que mejor se adapte a tus necesidades para comenzar.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SubscriptionManager />
                </CardContent>
            </Card>
        </div>
    )
}

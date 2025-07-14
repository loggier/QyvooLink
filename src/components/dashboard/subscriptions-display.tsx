
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, CreditCard, Sparkles, MessageSquare, Clock } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { loadStripe } from '@stripe/stripe-js';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isTrial: boolean;
  trialDays: number;
  isActive: boolean;
  isComingSoon?: boolean;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
}

interface UserSubscription {
    id: string; // Stripe subscription ID
    status: string;
    planId: string;
    priceId: string;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

export default function SubscriptionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [activePlanDetails, setActivePlanDetails] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPlans = async () => {
      try {
        const q = query(collection(db, 'subscriptions'), where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        const fetchedPlans: SubscriptionPlan[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPlans.push({ id: doc.id, ...doc.data() } as SubscriptionPlan);
        });
        
        fetchedPlans.sort((a, b) => {
          const aIsFree = a.priceMonthly === 0 && a.priceYearly === 0;
          const bIsFree = b.priceMonthly === 0 && b.priceYearly === 0;

          if (aIsFree && !bIsFree) return 1; 
          if (!aIsFree && bIsFree) return -1;
          
          return a.priceMonthly - b.priceMonthly;
        });

        setPlans(fetchedPlans);
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los planes.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, [user, toast]);
  
  useEffect(() => {
    if (!user) return;
    const subscriptionsRef = collection(db, 'users', user.uid, 'subscriptions');
    const q = query(subscriptionsRef, where('status', 'in', ['trialing', 'active']));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();

        const firestoreTimestamp = docData.current_period_end;
        
        const subData: UserSubscription = {
            id: docData.id,
            status: docData.status,
            planId: docData.planId,
            priceId: docData.priceId,
            cancel_at_period_end: docData.cancel_at_period_end,
            current_period_end: firestoreTimestamp?.toDate() ?? null,
        };
        setSubscription(subData);
      } else {
        setSubscription(null);
        setActivePlanDetails(null);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (subscription && plans.length > 0) {
      const planDetails = plans.find(p => p.id === subscription.planId);
      setActivePlanDetails(planDetails || null);
    }
  }, [subscription, plans]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes estar autenticado.' });
      return;
    }
    
    const priceId = billingCycle === 'monthly' ? plan.monthlyPriceId : plan.yearlyPriceId;
    if (!priceId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Este plan no tiene un precio configurado para el ciclo de facturación seleccionado.' });
      return;
    }

    setIsProcessing({ [plan.id]: true });
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, priceId, planId: plan.id }),
      });

      if (!res.ok) {
        const { message } = await res.json();
        throw new Error(message || 'No se pudo iniciar el proceso de pago.');
      }

      const { sessionId } = await res.json();
      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          throw new Error(error.message);
        }
      }
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      toast({ variant: 'destructive', title: 'Error de Pago', description: error.message });
    } finally {
      setIsProcessing({ [plan.id]: false });
    }
  };

  const handleManageSubscription = async () => {
     if (!user) return;
     setIsProcessing({ manage: true });
     try {
       const res = await fetch('/api/create-portal-link', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId: user.uid }),
       });
       if (!res.ok) throw new Error('No se pudo abrir el portal de gestión.');
       
       const { url } = await res.json();
       window.location.assign(url);
     } catch(error: any) {
       toast({ variant: 'destructive', title: 'Error', description: error.message });
     } finally {
       setIsProcessing({ manage: false });
     }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-8">
      {subscription && activePlanDetails && (
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 ring-2 ring-green-500/50">
            <CardHeader>
                <CardTitle className="flex items-center text-green-800 dark:text-green-300">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    Estás suscrito al Plan: {activePlanDetails.name}
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-400">
                    Tu suscripción está activa y lista para usar.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {subscription.current_period_end && subscription.current_period_end.getFullYear() > 1971 ? (
                    <div className="space-y-1">
                        <p className="text-sm">
                            {subscription.status === 'trialing' && 'Tu período de prueba termina y tu plan se renovará el '}
                            {subscription.status === 'active' && 'Tu plan se renovará el '}
                            <span className="font-semibold">{format(subscription.current_period_end, "dd 'de' MMMM 'de' yyyy", { locale: es })}</span>.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            (Renovación en {formatDistanceToNow(subscription.current_period_end, { locale: es })})
                        </p>
                    </div>
                ) : (
                    <p className="text-sm font-semibold">Fecha de renovación no disponible.</p>
                )}
                {subscription.cancel_at_period_end && (
                    <Badge variant="destructive" className="mt-2 block w-fit">Cancelación programada.</Badge>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleManageSubscription} disabled={isProcessing.manage}>
                    {isProcessing.manage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Gestionar Suscripción y Pagos
                </Button>
            </CardFooter>
        </Card>
      )}

      <div className="flex items-center justify-center space-x-2">
        <Label htmlFor="billingCycle" className={billingCycle === 'monthly' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>Mensual</Label>
        <Switch 
            id="billingCycle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
            disabled={!!subscription}
        />
        <Label htmlFor="billingCycle" className={billingCycle === 'yearly' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>Anual (Ahorra ~20%)</Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = subscription?.planId === plan.id;
          const isSubscribed = !!subscription;
          const isDisabled = isSubscribed || plan.isComingSoon;

          return (
          <Card key={plan.id} className={cn(
            "flex flex-col transition-shadow hover:shadow-xl", 
            isCurrentPlan && "ring-2 ring-primary shadow-lg",
            plan.isComingSoon && "bg-muted/50"
          )}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="flex items-center">
                   <Sparkles className="h-5 w-5 mr-2 text-primary"/>
                   {plan.name}
                </CardTitle>
                {plan.isComingSoon && <Badge variant="secondary" className="bg-blue-100 text-blue-800">Próximamente</Badge>}
              </div>
              <CardDescription>
                {plan.priceMonthly === 0 && plan.priceYearly === 0 ? (
                    <span className="text-3xl font-bold text-foreground">
                        Personalizado
                    </span>
                ) : (
                    <>
                        <span className="text-3xl font-bold text-foreground">
                            ${billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}
                        </span>
                        /{billingCycle === 'monthly' ? 'mes' : 'año'}
                    </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.priceMonthly === 0 && plan.priceYearly === 0 ? (
                 <Button asChild className="w-full" variant="outline">
                   <a 
                     href={`https://wa.me/528118627025?text=${encodeURIComponent('quiero plan personalizado de qyvoo')}`}
                     target="_blank"
                     rel="noopener noreferrer"
                   >
                     <MessageSquare className="mr-2 h-4 w-4" />
                     Contactar a Venta
                   </a>
                 </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => handleSubscribe(plan)}
                  disabled={isProcessing[plan.id] || isDisabled}
                >
                  {isProcessing[plan.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                   plan.isComingSoon ? <Clock className="mr-2 h-4 w-4" /> :
                   isCurrentPlan ? <CheckCircle className="mr-2 h-4 w-4" /> : 
                   <CreditCard className="mr-2 h-4 w-4" />}
                  {isCurrentPlan ? "Tu Plan Actual" : plan.isComingSoon ? "Próximamente" : "Suscribirse"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )})}
      </div>
    </div>
  );
}

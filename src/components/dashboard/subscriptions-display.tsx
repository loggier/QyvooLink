"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, CreditCard, Sparkles, MessageSquare } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { loadStripe } from '@stripe/stripe-js';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isTrial: boolean;
  trialDays: number;
  isActive: boolean;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
}

interface UserSubscription {
    id: string; // Stripe subscription ID
    status: string;
    planId: string;
    priceId: string;
    current_period_end: { seconds: number; nanoseconds: number; };
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

          if (aIsFree && !bIsFree) {
            return 1; // a (free) comes after b (paid)
          }
          if (!aIsFree && bIsFree) {
            return -1; // a (paid) comes before b (free)
          }
          // If both are free or both are paid, sort by price
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
        const subData = snapshot.docs[0].data() as UserSubscription;
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
        const errorData = await res.json();
        throw new Error(errorData.error || 'No se pudo iniciar el proceso de pago.');
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
  
  if (subscription && activePlanDetails) {
    const renewalDate = new Date(subscription.current_period_end.seconds * 1000);
    return (
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardHeader>
                <CardTitle className="flex items-center text-green-800 dark:text-green-300">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    Estás suscrito al Plan: {activePlanDetails.name}
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-400">
                    Tu suscripción está activa.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm">
                    {subscription.status === 'trialing' && 'Tu período de prueba termina y tu plan se renovará el '}
                    {subscription.status === 'active' && 'Tu plan se renovará el '}
                    <span className="font-semibold">{format(renewalDate, 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}</span>.
                </p>
                {subscription.cancel_at_period_end && (
                    <Badge variant="destructive" className="mt-2">Cancelación programada para el final del período.</Badge>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleManageSubscription} disabled={isProcessing.manage}>
                    {isProcessing.manage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Gestionar Suscripción
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-2">
        <Label htmlFor="billingCycle" className={billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}>Mensual</Label>
        <Switch 
            id="billingCycle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
        />
        <Label htmlFor="billingCycle" className={billingCycle === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}>Anual (Ahorra 20%)</Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                 <Sparkles className="h-5 w-5 mr-2 text-primary"/>
                 {plan.name}
              </CardTitle>
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
                  disabled={isProcessing[plan.id]}
                >
                  {isProcessing[plan.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Suscribirse al Plan {plan.name}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

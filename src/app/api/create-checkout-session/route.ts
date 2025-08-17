
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(req: Request) {
  if (!stripe) {
    return new NextResponse(
      'Stripe is not configured on the server. Missing STRIPE_SECRET_KEY.',
      { status: 500 }
    );
  }
  
  try {
    const { userId, priceId, planId, isAddon = false } = await req.json();

    if (!userId || !priceId || !planId) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // --- 1. Fetch User Data ---
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return new NextResponse('User not found', { status: 404 });
    }
    
    const userData = userDocSnap.data();
    let stripeCustomerId = userData.stripeCustomerId;

    // --- Create Stripe Customer if they don't have one ---
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.fullName,
        metadata: { firebaseUID: userId },
      });
      stripeCustomerId = customer.id;
      await setDoc(userDocRef, { stripeCustomerId }, { merge: true });
    }

    // --- 2. Check for an existing subscription ---
    const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
    const q = query(subscriptionsRef, where('status', 'in', ['trialing', 'active']), limit(1));
    const subscriptionSnapshot = await getDocs(q);
    const existingSubscription = !subscriptionSnapshot.empty ? subscriptionSnapshot.docs[0].data() : null;

    // --- 3. Handle Add-on purchase to existing subscription ---
    if (isAddon && existingSubscription) {
        const subscription = await stripe.subscriptions.retrieve(existingSubscription.id);

        await stripe.subscriptionItems.create({
            subscription: subscription.id,
            price: priceId,
            quantity: 1,
            // Proration is enabled by default. Stripe will create an immediate invoice for the new item.
        });

        // Since this doesn't use a checkout session, we return a success message directly.
        // The webhook will handle the Firestore update.
        return NextResponse.json({ success: true, message: 'Add-on agregado exitosamente. Refresca la página en un momento.' });
    }


    // --- 4. Handle NEW subscription checkout ---
    const planDocRef = doc(db, 'subscriptions', planId);
    const planDocSnap = await getDoc(planDocRef);

    if (!planDocSnap.exists()) {
        return new NextResponse('Plan not found', { status: 404 });
    }
    const planData = planDocSnap.data();
    const isTrial = planData.isTrial === true;
    const trialDays = planData.trialDays > 0 ? planData.trialDays : null;

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: `${origin}/dashboard/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/profile`,
      subscription_data: {
        metadata: {
          firebaseUID: userId,
          planId: planId,
        },
      },
      metadata: {
        firebaseUID: userId,
        planId: planId,
        priceId: priceId,
      },
    };
    
    if (isTrial && trialDays) {
        if(sessionParams.subscription_data) {
            sessionParams.subscription_data.trial_period_days = trialDays;
        }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

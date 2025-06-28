
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
    const { userId, priceId, planId } = await req.json();

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

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.fullName,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      // Save the new Stripe customer ID to Firestore
      await setDoc(userDocRef, { stripeCustomerId }, { merge: true });
    }
    
    // --- 2. Fetch Plan Data to check for trial ---
    const planDocRef = doc(db, 'subscriptions', planId);
    const planDocSnap = await getDoc(planDocRef);

    if (!planDocSnap.exists()) {
        return new NextResponse('Plan not found', { status: 404 });
    }
    const planData = planDocSnap.data();
    const isTrial = planData.isTrial === true;
    const trialDays = planData.trialDays > 0 ? planData.trialDays : null;

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    // --- 3. Build the session parameters ---
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
    
    // Add trial period if applicable
    if (isTrial && trialDays) {
        if(sessionParams.subscription_data) {
            sessionParams.subscription_data.trial_period_days = trialDays;
        }
    }

    // --- 4. Create Stripe Checkout session ---
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

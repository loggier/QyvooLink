
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (!stripe) {
    return new NextResponse(
      'Stripe is not configured on the server. Missing STRIPE_SECRET_KEY.',
      { status: 500 }
    );
  }
  
  try {
    const { userId } = await req.json();
    if (!userId) {
      return new NextResponse('User not found', { status: 400 });
    }

    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return new NextResponse('User not found in DB', { status: 404 });
    }
    
    const userData = userDocSnap.data();
    let stripeCustomerId = userData.stripeCustomerId;

    // --- Self-healing logic ---
    // If the customer ID is missing, try to find it on Stripe by email
    if (!stripeCustomerId) {
        console.log(`Stripe customer ID not found for user ${userId}. Searching by email...`);
        const customers = await stripe.customers.list({
            email: userData.email,
            limit: 1,
        });

        if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
            console.log(`Found existing Stripe customer ${stripeCustomerId} for user ${userId}. Updating Firestore.`);
            await setDoc(userDocRef, { stripeCustomerId }, { merge: true });
        }
    }
    // --- End of self-healing logic ---
    
    if (!stripeCustomerId) {
        return new NextResponse('Stripe customer ID not found for user. Cannot manage subscription.', { status: 400 });
    }
    
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/dashboard/profile`,
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (error: any) {
    console.error('Error creating portal link:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

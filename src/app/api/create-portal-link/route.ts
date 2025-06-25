
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
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
    
    const { stripeCustomerId } = userDocSnap.data();
    if (!stripeCustomerId) {
        return new NextResponse('Stripe customer ID not found for user', { status: 400 });
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

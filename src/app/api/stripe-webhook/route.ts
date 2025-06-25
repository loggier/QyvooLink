
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(req: Request) {
  if (!stripe) {
    return new NextResponse(
      'Stripe is not configured on the server. Missing STRIPE_SECRET_KEY.',
      { status: 500 }
    );
  }
  
  const body = await req.text();
  const sig = headers().get('Stripe-Signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('Webhook secret or signature not found.');
    return new NextResponse('Webhook secret not configured', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.metadata?.firebaseUID || !session.subscription || !session.customer) {
          throw new Error('Missing metadata in checkout session.');
        }
        
        const subscription = await stripe.subscriptions.retrieve(session.subscription.toString());
        
        const subscriptionData = {
          id: subscription.id,
          userId: session.metadata.firebaseUID,
          status: subscription.status,
          planId: session.metadata.planId,
          priceId: session.metadata.priceId,
          current_period_end: new Date(subscription.current_period_end * 1000),
          created: new Date(subscription.created * 1000),
          cancel_at_period_end: subscription.cancel_at_period_end,
          stripeCustomerId: session.customer.toString(),
        };
        
        const subscriptionRef = doc(db, 'users', session.metadata.firebaseUID, 'subscriptions', subscription.id);
        await setDoc(subscriptionRef, subscriptionData);

        // Also update the main user doc with the stripe customer ID if it's not there
        const userRef = doc(db, 'users', session.metadata.firebaseUID);
        await setDoc(userRef, { stripeCustomerId: session.customer.toString() }, { merge: true });

        console.log(`Subscription created for user ${session.metadata.firebaseUID}`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer.toString()) as Stripe.Customer;
        const userId = customer.metadata.firebaseUID;
        
        if (!userId) {
          throw new Error('User ID not found in customer metadata.');
        }

        const subscriptionData = {
          id: subscription.id,
          userId: userId,
          status: subscription.status,
          priceId: subscription.items.data[0].price.id,
          current_period_end: new Date(subscription.current_period_end * 1000),
          cancel_at_period_end: subscription.cancel_at_period_end,
        };

        const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
        await setDoc(subscriptionRef, subscriptionData, { merge: true });
        
        console.log(`Subscription ${subscription.id} for user ${userId} updated.`);
        break;
      }
      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (error: any) {
    console.error('Webhook handler failed.', error);
    return new NextResponse('Webhook handler failed. View logs.', { status: 500 });
  }

  return NextResponse.json({ received: true });
}

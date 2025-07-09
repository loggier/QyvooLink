
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

// Helper function to create a consistent subscription data object for Firestore
const toSubscriptionModel = (subscription: Stripe.Subscription, userId: string, planId?: string) => {
    return {
        id: subscription.id,
        userId: userId,
        status: subscription.status,
        planId: planId || subscription.metadata.planId, // Use provided planId or from subscription metadata
        priceId: subscription.items.data[0].price.id,
        // Robust handling of the end date.
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        created: subscription.created ? new Date(subscription.created * 1000) : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        stripeCustomerId: subscription.customer.toString(),
    };
};

export async function POST(req: Request) {
  if (!stripe) {
    console.error('Stripe webhook failed: Stripe is not configured.');
    return new NextResponse(
      'Stripe is not configured on the server. Missing STRIPE_SECRET_KEY.',
      { status: 500 }
    );
  }
  
  console.log('Stripe webhook received.');
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
    console.log(`Received and verified event type: ${event.type}`);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  if (!relevantEvents.has(event.type)) {
     console.log(`Ignoring irrelevant event type: ${event.type}`);
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed...');
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (!session.metadata?.firebaseUID || !session.subscription) {
          console.error('Missing metadata in checkout session.', { metadata: session.metadata });
          throw new Error('Missing metadata in checkout session.');
        }
        
        const subscription = await stripe.subscriptions.retrieve(session.subscription.toString());
        
        // Use the helper to create the data object
        const subscriptionData = toSubscriptionModel(subscription, session.metadata.firebaseUID, session.metadata.planId);
        
        const subscriptionRef = doc(db, 'users', session.metadata.firebaseUID, 'subscriptions', subscription.id);
        console.log(`Attempting to write subscription data to Firestore at path: ${subscriptionRef.path}`);
        await setDoc(subscriptionRef, subscriptionData);

        // Also update the main user doc with the stripe customer ID if it's not there
        const userRef = doc(db, 'users', session.metadata.firebaseUID);
        await setDoc(userRef, { stripeCustomerId: subscription.customer.toString() }, { merge: true });

        console.log(`Successfully created subscription for user ${session.metadata.firebaseUID}`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        console.log(`Processing ${event.type}...`);
        const subscription = event.data.object as Stripe.Subscription;
        
        // Get user ID from subscription metadata (more reliable)
        const userId = subscription.metadata.firebaseUID;
        
        if (!userId) {
          console.error('User ID (firebaseUID) not found in subscription metadata.');
          throw new Error('User ID not found in subscription metadata.');
        }
        
        // Use the helper to create the data object, it will get planId from metadata
        const subscriptionData = toSubscriptionModel(subscription, userId);
        
        const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
        console.log(`Attempting to update/delete subscription data at path: ${subscriptionRef.path}`);
        await setDoc(subscriptionRef, subscriptionData, { merge: true });
        
        console.log(`Subscription ${subscription.id} for user ${userId} updated/deleted.`);
        break;
      }
      default:
        console.warn(`Unhandled relevant event type: ${event.type}`);
    }
  } catch (error: any) {
    console.error(`Webhook handler failed for event type ${event.type}.`, error);
    return new NextResponse('Webhook handler failed. View logs.', { status: 500 });
  }

  return NextResponse.json({ received: true });
}

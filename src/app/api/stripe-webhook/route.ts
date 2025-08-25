
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
  'invoice.payment_succeeded', // Listen for this to catch add-on payments
]);

// Helper function to create a consistent subscription data object for Firestore
const toSubscriptionModel = (subscription: Stripe.Subscription, userId: string, planId?: string) => {
    // Determine the primary planId. If there are multiple items, we might need a more complex logic.
    // For now, we prioritize the planId from metadata, then the first subscription item.
    const primaryItem = subscription.items.data[0];
    const resolvedPlanId = planId || subscription.metadata.planId || primaryItem.metadata.planId;

    return {
        id: subscription.id,
        userId: userId,
        status: subscription.status,
        planId: resolvedPlanId,
        // Store all price IDs to handle multiple items like add-ons
        priceIds: subscription.items.data.map(item => item.price.id),
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        created: subscription.created ? new Date(subscription.created * 1000) : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        stripeCustomerId: subscription.customer.toString(),
        // Store all items for more detailed logic, e.g., counting add-ons
        items: subscription.items.data.map(item => ({
            id: item.id,
            priceId: item.price.id,
            quantity: item.quantity,
        })),
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
        
        const subscriptionData = toSubscriptionModel(subscription, session.metadata.firebaseUID, session.metadata.planId);
        
        const subscriptionRef = doc(db, 'users', session.metadata.firebaseUID, 'subscriptions', subscription.id);
        console.log(`Attempting to write subscription data to Firestore at path: ${subscriptionRef.path}`);
        await setDoc(subscriptionRef, subscriptionData);

        const userRef = doc(db, 'users', session.metadata.firebaseUID);
        await setDoc(userRef, { stripeCustomerId: subscription.customer.toString() }, { merge: true });

        console.log(`Successfully created subscription for user ${session.metadata.firebaseUID}`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        console.log(`Processing ${event.type}...`);
        const subscription = event.data.object as Stripe.Subscription;
        
        const userId = subscription.metadata.firebaseUID;
        
        if (!userId) {
          console.error('User ID (firebaseUID) not found in subscription metadata.');
          throw new Error('User ID not found in subscription metadata.');
        }
        
        const subscriptionData = toSubscriptionModel(subscription, userId);
        
        const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
        console.log(`Attempting to update/delete subscription data at path: ${subscriptionRef.path}`);
        await setDoc(subscriptionRef, subscriptionData, { merge: true });
        
        console.log(`Subscription ${subscription.id} for user ${userId} updated/deleted.`);
        break;
      }
       case 'invoice.payment_succeeded': {
        console.log('Processing invoice.payment_succeeded...');
        const invoice = event.data.object as Stripe.Invoice;

        // An add-on was added, or a regular payment was made. We need to update the subscription document in Firestore
        // to reflect the new state (e.g., new period end, new items).
        if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription.toString());
            const userId = subscription.metadata.firebaseUID;
            
            if (userId) {
                const subscriptionData = toSubscriptionModel(subscription, userId);
                const subscriptionRef = doc(db, 'users', userId, 'subscriptions', subscription.id);
                await setDoc(subscriptionRef, subscriptionData, { merge: true });
                console.log(`Subscription ${subscription.id} updated due to payment.`);
            }
        }
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

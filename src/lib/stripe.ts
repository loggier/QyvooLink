import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Initialize stripe as null
let stripe: Stripe | null = null;

if (stripeSecretKey) {
  // If the key exists, create a new instance
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
  });
} else {
  // In a server environment during development, log an error.
  // This won't run on the client, and won't show in production logs to avoid noise.
  if (process.env.NODE_ENV === 'development') {
    console.error(
      'STRIPE_SECRET_KEY is not set in environment variables. ' +
      'Please add it to your .env.local file. Stripe functionality will be disabled.'
    );
  }
}

export { stripe };

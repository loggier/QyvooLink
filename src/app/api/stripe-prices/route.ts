
import { stripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function GET() {
  if (!stripe) {
    return new NextResponse('Stripe is not configured.', { status: 500 });
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100, // Adjust as needed
    });

    const monthlyPrices = prices.data.filter(
      (price) => price.recurring?.interval === 'month'
    );
    const yearlyPrices = prices.data.filter(
      (price) => price.recurring?.interval === 'year'
    );

    // Helper to format price data, ensuring product is treated as an object
    const formatPrice = (price: Stripe.Price) => ({
      id: price.id,
      unit_amount: price.unit_amount,
      currency: price.currency,
      product: {
        id: (price.product as Stripe.Product).id,
        name: (price.product as Stripe.Product).name,
      },
    });

    return NextResponse.json({
      monthly: monthlyPrices.map(formatPrice),
      yearly: yearlyPrices.map(formatPrice),
    });
  } catch (error: any) {
    console.error('Error fetching Stripe prices:', error);
    return new NextResponse(error.message || 'Internal Server Error', {
      status: 500,
    });
  }
}


import { NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/recaptcha';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    const success = await verifyRecaptcha(token);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'reCAPTCHA verification failed.' }, { status: 400 });
    }
    
  } catch (error) {
    console.error("reCAPTCHA verification endpoint error:", error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

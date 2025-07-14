
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'reCAPTCHA token is missing.' }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        console.error("RECAPTCHA_SECRET_KEY is not set on the server.");
        return NextResponse.json({ success: false, error: 'Server configuration error.' }, { status: 500 });
    }

    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const response = await fetch(verificationUrl, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: data['error-codes'] || 'Verification failed.' }, { status: 400 });
    }
  } catch (error) {
    console.error("reCAPTCHA verification endpoint error:", error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

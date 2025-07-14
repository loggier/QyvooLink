
"use server";

export async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    if (!token) {
      console.warn("reCAPTCHA token is missing.");
      return false;
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        console.error("RECAPTCHA_SECRET_KEY is not set on the server.");
        // In a real application, you might want to fail open or closed depending on security policy.
        // For now, we fail closed.
        return false;
    }

    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
    });

    const data = await response.json();
    
    if (data.success) {
      return true;
    } else {
      console.warn("reCAPTCHA verification failed:", data['error-codes']);
      return false;
    }
  } catch (error) {
    console.error("reCAPTCHA verification request failed:", error);
    return false;
  }
}

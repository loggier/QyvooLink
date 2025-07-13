
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateAppointmentSchema, createAppointment } from '@/ai/tools/schedule';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(req: Request) {
  try {
    let rawJson = await req.json();

    // Handle cases where the JSON is nested under a "JSON" key
    const inputData = rawJson.JSON ? rawJson.JSON : rawJson;
    
    // Fetch the user's timezone from Firestore
    if (!inputData.userId) {
        return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }
    const userDocRef = doc(db, 'users', inputData.userId);
    const userDocSnap = await getDoc(userDocRef);

    let userTimezone = 'UTC'; // Default to UTC if not found
    if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        userTimezone = userData.timezone || 'UTC';
    }
    
    const dataWithTimezone = {
        ...inputData,
        timezone: userTimezone,
    };

    const validation = CreateAppointmentSchema.safeParse(dataWithTimezone);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data.', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const result = await createAppointment(validation.data);
    
    if (result.success) {
      return NextResponse.json({ success: true, appointmentId: result.appointmentId });
    } else {
      return NextResponse.json({ success: false, error: 'Failed to create appointment in database.' }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in /api/tools/create-appointment:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.', details: error.message }, { status: 500 });
  }
}

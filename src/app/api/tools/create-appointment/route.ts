
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAppointment } from '@/ai/tools/schedule';
import { CreateAppointmentSchema } from '@/ai/schemas';

export async function POST(req: Request) {
  try {
    const rawJson = await req.json();

    // Handle cases where the JSON is nested under a "JSON" key by the AI
    const inputData = rawJson.JSON ? rawJson.JSON : rawJson;

    const validation = CreateAppointmentSchema.safeParse(inputData);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data.', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    // Call the core logic function with the validated data
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

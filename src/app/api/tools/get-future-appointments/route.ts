
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFutureAppointments } from '@/ai/tools/schedule';
import { GetFutureAppointmentsSchema } from '@/ai/schemas';


export async function POST(req: Request) {
  try {
    const rawJson = await req.json();
    
    // Handle cases where the JSON is nested under a "JSON" key by the AI
    const inputData = rawJson.JSON ? rawJson.JSON : rawJson;

    const validation = GetFutureAppointmentsSchema.safeParse(inputData);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data.', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    // Call the core logic function with the validated data
    const result = await getFutureAppointments(validation.data);
    
    // Return the result of the function directly
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Error in /api/tools/get-future-appointments:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.', details: error.message }, { status: 500 });
  }
}

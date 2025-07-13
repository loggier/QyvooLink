// src/app/api/tools/create-appointment/route.ts
import { NextResponse } from 'next/server';
import { CreateAppointmentSchema, createAppointment } from '@/ai/tools/schedule';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const rawJson = await req.json();

    // Handle cases where the data might be nested under a "JSON" key
    const jsonToValidate = rawJson.JSON ? rawJson.JSON : rawJson;

    // Validate the incoming JSON against the appointment schema
    const validationResult = CreateAppointmentSchema.safeParse(jsonToValidate);

    if (!validationResult.success) {
      // If validation fails, return a detailed error response
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data.', 
          details: validationResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    // If validation succeeds, call the core logic function
    const result = await createAppointment(validationResult.data);

    if (result.success) {
      return NextResponse.json(result, { status: 201 }); // 201 Created
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create appointment in database.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in /api/tools/create-appointment:', error);
    // Handle JSON parsing errors or other unexpected errors
    let errorMessage = 'Internal Server Error';
    if (error instanceof z.ZodError) {
        errorMessage = 'Validation error';
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    return new NextResponse(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

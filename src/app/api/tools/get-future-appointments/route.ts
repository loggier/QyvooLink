
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFutureAppointments, GetFutureAppointmentsOutputSchema } from '@/ai/tools/schedule';

// Define el schema para la validación de la entrada del POST
const GetFutureAppointmentsRequestSchema = z.object({
  contactPhone: z.string().min(1, "El contactPhone es obligatorio."),
  organizationId: z.string().min(1, "El organizationId es obligatorio."),
  userId: z.string().min(1, "El userId es obligatorio."),
});

export async function POST(req: Request) {
  try {
    const inputData = await req.json();

    const validation = GetFutureAppointmentsRequestSchema.safeParse(inputData);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data.', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    // Llama a la función de lógica principal con los datos validados
    const result = await getFutureAppointments(validation.data);
    
    // Devuelve el resultado de la función directamente
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Error in /api/tools/get-future-appointments:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.', details: error.message }, { status: 500 });
  }
}

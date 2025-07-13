
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ai } from '@/ai/genkit';
import { createAppointment, CreateAppointmentSchema } from '@/ai/tools/schedule';

// Define the schema for the incoming request
const SendMessageSchema = z.object({
  chatId: z.string(),
  instanceId: z.string(),
  message: z.string(),
  userId: z.string(),
  organizationId: z.string(),
});

// Main POST handler for the API route
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const validation = SendMessageSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { chatId, instanceId, message, userId, organizationId } = validation.data;

    // 1. Fetch the active bot's prompt for the organization
    const qybotDocRef = doc(db, 'qybot', organizationId);
    const qybotDocSnap = await getDoc(qybotDocRef);

    if (!qybotDocSnap.exists()) {
      return NextResponse.json({ error: 'Bot configuration not found for this organization.' }, { status: 404 });
    }
    const promptXml = qybotDocSnap.data()?.promptXml || '<prompt>No bot prompt configured.</prompt>';
    const finalPrompt = `${promptXml}\n\nUSER_MESSAGE: "${message}"`;

    // 2. Define the tool for Genkit to use
    const appointmentTool = ai.defineTool(
      {
        name: 'createAppointment',
        description: "Creates a new appointment, meeting, or event in the user's calendar. Use this when a user confirms they want to schedule something.",
        inputSchema: CreateAppointmentSchema.omit({ userId: true, organizationId: true }), // The AI doesn't need to know these
        outputSchema: z.object({ success: z.boolean() }),
      },
      async (input) => {
        console.log('Tool `createAppointment` called by AI with input:', input);
        // Add the necessary IDs before calling the actual function
        return createAppointment({ ...input, userId, organizationId });
      }
    );

    // 3. Call the AI model with the prompt and the tool
    const { output } = await ai.generate({
      prompt: finalPrompt,
      tools: [appointmentTool],
      model: 'googleai/gemini-2.0-flash',
    });

    if (!output) {
      return NextResponse.json({ error: 'AI did not produce an output.' }, { status: 500 });
    }

    let responseMessage: string;
    
    // 4. Process the AI's output
    if (output.tools?.length) {
      const toolCall = output.tools[0];
      const toolResponse = await toolCall.response; // This executes the tool function body
      console.log('Tool response:', toolResponse);
      
      // Based on the tool's response, generate a final message for the user
      if (toolCall.name === 'createAppointment' && toolResponse.success) {
        responseMessage = "¡Perfecto! He agendado la cita. ¿Hay algo más en lo que pueda ayudarte?";
      } else {
        responseMessage = "Parece que hubo un problema al intentar agendar la cita. Un agente lo revisará pronto.";
      }
    } else {
      // If no tool was called, the output is plain text
      responseMessage = output.text!;
    }

    // 5. Save the bot's response to the chat log
    await addDoc(collection(db, 'chat'), {
      chat_id: chatId,
      from: `instance_${instanceId}`,
      to: chatId,
      instanceId: instanceId,
      mensaje: responseMessage,
      user_name: 'bot',
      timestamp: serverTimestamp(),
      type: 'message',
    });
    
    // 6. Send the response back to N8N (or whatever called this API)
    return NextResponse.json({ response: responseMessage });

  } catch (error: any) {
    console.error('Error in send-message API:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

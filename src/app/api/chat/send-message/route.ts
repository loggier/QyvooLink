// src/app/api/chat/send-message/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Este es un endpoint de proxy/orquestador muy simplificado.
// En una implementación real, aquí es donde llamarías al backend de Genkit/IA
// con el mensaje y el contexto del usuario para obtener una respuesta inteligente.

export async function POST(req: Request) {
  try {
    const { userId, chatId, message, instanceId, instanceName } = await req.json();

    if (!userId || !chatId || !message || !instanceId) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }
    
    // Aquí es donde la lógica de la IA debería vivir.
    // Por ahora, simularemos que la IA responde y lo envía al webhook de n8n
    // para mantener la compatibilidad con el sistema existente, pero este es el
    // punto de entrada para usar herramientas.

    // TODO: Reemplazar esta llamada directa con una llamada al motor de Genkit
    // que puede usar herramientas como `createAppointment`.
    // const aiResponse = await runGenkitFlow(message, { userId, chatId });

    const webhookPayload = [{
      chat_id: chatId,
      instanceId: instanceId,
      mensaje: message,
      instance: instanceName,
      user_name: "agente", // Backend de n8n espera "agente"
      timestamp: new Date().toISOString(),
    }];

    const webhookUrl = "https://n8n.vemontech.com/webhook/qyvoo";

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
        const errorData = await webhookResponse.text();
        console.error("Error forwarding message to n8n webhook:", webhookResponse.status, errorData);
        throw new Error(`Failed to forward message to n8n: ${webhookResponse.status}`);
    }

    // Si la IA generara una respuesta, la devolveríamos aquí.
    // Como n8n maneja la respuesta, devolvemos un éxito simple.
    return NextResponse.json({ success: true, message: "Message forwarded to n8n for processing." });

  } catch (error: any) {
    console.error('Error in send-message API route:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

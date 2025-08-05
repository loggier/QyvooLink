
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { z } from 'zod';

// Define el esquema para validar los datos de entrada de la API
const sendMessageSchema = z.object({
  apiKey: z.string().min(1, { message: "apiKey es requerida." }),
  number: z.string().min(1, { message: "El número de teléfono es requerido." }),
  message: z.string().min(1, { message: "El mensaje es requerido." }),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Validar el cuerpo de la petición
    const validation = sendMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Datos de entrada inválidos.', details: validation.error.flatten() }, { status: 400 });
    }

    let { apiKey, number, message } = validation.data;

    // 2. Autenticar la apiKey
    const instancesRef = collection(db, 'instances');
    const q = query(instancesRef, where('apiKey', '==', apiKey), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ success: false, error: 'apiKey inválida o no encontrada.' }, { status: 401 });
    }

    const instanceDoc = querySnapshot.docs[0];
    const instanceData = instanceDoc.data();
    const { name: instanceName, userId } = instanceData;

    // 3. Formatear el número de teléfono
    // Limpia el número de cualquier caracter que no sea un dígito
    const cleanedNumber = number.replace(/\D/g, '');
    const formattedNumber = `${cleanedNumber}@s.whatsapp.net`;


    // 4. Determinar el Webhook URL (Test o Producción)
    const useTestWebhook = process.env.NEXT_PUBLIC_USE_TEST_WEBHOOK !== 'false';
    const prodWebhookBase = process.env.NEXT_PUBLIC_N8N_PROD_WEBHOOK_URL;
    const testWebhookBase = process.env.NEXT_PUBLIC_N8N_TEST_WEBHOOK_URL;

    let baseWebhookUrl: string | undefined;
    if (useTestWebhook) {
      baseWebhookUrl = testWebhookBase;
    } else {
      baseWebhookUrl = prodWebhookBase;
    }

    if (!baseWebhookUrl) {
      console.error('El webhook URL de n8n no está configurado en el servidor.');
      return NextResponse.json({ success: false, error: 'El servidor no está configurado para enviar mensajes.' }, { status: 500 });
    }

    const webhookUrl = `${baseWebhookUrl}?action=send_message`;
    
    // 5. Preparar y enviar la petición al webhook de n8n
    const webhookPayload = {
      number: formattedNumber,
      message: message,
      instanceName: instanceName,
      token: apiKey, // El token es la misma apiKey
      userId: userId,
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });
    
    // 6. Manejar la respuesta del webhook
    if (!webhookResponse.ok) {
      const errorData = await webhookResponse.json();
      console.error("Error desde el webhook de n8n:", webhookResponse.status, errorData);
      return NextResponse.json({ success: false, error: 'El servicio de envío de mensajes falló.', details: errorData.message || `Error del webhook: ${webhookResponse.statusText}` }, { status: 502 });
    }
    
    console.log(`Mensaje para ${number} enviado exitosamente a la cola de n8n.`);
    return NextResponse.json({ success: true, message: 'Mensaje encolado para envío.' });

  } catch (error: any) {
    console.error('Error en el endpoint /api/send-message:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, error: 'Cuerpo de la petición inválido (no es un JSON válido).' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}

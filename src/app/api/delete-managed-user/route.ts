
'use server';

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    // 1. Inicializar Firebase Admin SDK en cada llamada
    const adminApp = initializeAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    // 2. Obtener los datos de la petición
    const idToken = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Token de autorización no proporcionado.' }, { status: 401 });
    }

    const { managerUid } = await req.json();
    if (!managerUid) {
      return NextResponse.json({ error: 'Falta el UID del manager a eliminar.' }, { status: 400 });
    }

    // 3. Verificar el token del usuario que realiza la acción (el owner)
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const ownerUid = decodedToken.uid;

    // 4. Obtener los documentos del owner y del manager a eliminar
    const ownerDocRef = adminDb.collection('users').doc(ownerUid);
    const managerDocRef = adminDb.collection('users').doc(managerUid);

    const [ownerDocSnap, managerDocSnap] = await Promise.all([
      ownerDocRef.get(),
      managerDocRef.get(),
    ]);

    // 5. Realizar las validaciones de seguridad
    if (!ownerDocSnap.exists() || ownerDocSnap.data()?.role !== 'owner') {
      return NextResponse.json({ error: 'Permiso denegado: El solicitante no es un propietario.' }, { status: 403 });
    }

    if (!managerDocSnap.exists()) {
      // Si el documento ya no existe, consideramos la operación como exitosa.
      console.log(`El documento para el manager ${managerUid} ya no existe en Firestore. Se considera eliminado.`);
      return NextResponse.json({ success: true, message: 'El usuario ya había sido eliminado de la base de datos.' });
    }
    
    const ownerOrgId = ownerDocSnap.data()?.organizationId;
    const managerData = managerDocSnap.data();

    if (ownerOrgId !== managerData?.organizationId) {
      return NextResponse.json({ error: 'Permiso denegado: El manager no pertenece a la organización del propietario.' }, { status: 403 });
    }

    // 6. Eliminar el documento del manager de Firestore
    await managerDocRef.delete();
    console.log(`Documento del usuario ${managerUid} eliminado de Firestore por el owner ${ownerUid}.`);

    return NextResponse.json({ success: true, message: 'Instancia eliminada de la base de datos correctamente.' });

  } catch (error: any) {
    console.error('Error crítico en /api/delete-managed-user:', error);
    // Devuelve un error JSON estructurado en caso de fallo
    return NextResponse.json({ error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}

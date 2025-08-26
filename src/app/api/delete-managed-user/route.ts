
'use server';

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const adminApp = initializeAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    const idToken = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Token de autorización no proporcionado.' }, { status: 401 });
    }

    const { managerUid } = await req.json();
    if (!managerUid) {
      return NextResponse.json({ error: 'Falta el UID del manager a eliminar.' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const ownerUid = decodedToken.uid;

    const ownerDocRef = adminDb.collection('users').doc(ownerUid);
    const managerDocRef = adminDb.collection('users').doc(managerUid);

    const [ownerDocSnap, managerDocSnap] = await Promise.all([
      ownerDocRef.get(),
      managerDocRef.get(),
    ]);

    if (!ownerDocSnap.exists() || ownerDocSnap.data()?.role !== 'owner') {
      return NextResponse.json({ error: 'Permiso denigado: El solicitante no es un propietario.' }, { status: 403 });
    }

    if (managerDocSnap.exists()) {
        const managerData = managerDocSnap.data();
        if (managerData?.managedBy !== ownerUid) {
            return NextResponse.json({ error: 'Permiso denegado: El solicitante no es el propietario de esta instancia.' }, { status: 403 });
        }
        
        // As requested, only delete from Firestore for now.
        await managerDocRef.delete();
        console.log(`Documento del usuario ${managerUid} eliminado de Firestore.`);
    } else {
        console.log(`El documento del usuario ${managerUid} no fue encontrado en Firestore, puede que ya haya sido eliminado.`);
    }

    // --- Firebase Auth user deletion is temporarily disabled as per request ---
    // try {
    //     await adminAuth.deleteUser(managerUid);
    //     console.log(`Usuario ${managerUid} eliminado de Firebase Authentication.`);
    // } catch (authError: any) {
    //     if (authError.code === 'auth/user-not-found') {
    //         console.log(`El usuario ${managerUid} no se encontró en Authentication, probablemente ya fue eliminado.`);
    //     } else {
    //         throw authError; // Re-throw other auth errors to be caught below
    //     }
    // }
    
    return NextResponse.json({ success: true, message: 'Instancia eliminada de la base de datos correctamente.' });

  } catch (error: any) {
    console.error('Error crítico en /api/delete-managed-user:', error);
    return NextResponse.json({ error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}

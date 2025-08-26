
'use server';

import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const adminApp = initializeAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    const idToken = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'No autorizado: Token no proporcionado.' }, { status: 401 });
    }
    
    let ownerUid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      ownerUid = decodedToken.uid;
    } catch (error) {
      console.error('Error verifying ID token:', error);
      return NextResponse.json({ error: 'No autorizado: Token inválido.' }, { status: 401 });
    }

    const { managerUid } = await req.json();
    if (!managerUid) {
      return NextResponse.json({ error: 'Falta el UID del manager.' }, { status: 400 });
    }

    const managerDocRef = adminDb.collection('users').doc(managerUid);
    const managerDocSnap = await managerDocRef.get();
    const ownerDocRef = adminDb.collection('users').doc(ownerUid);
    const ownerDocSnap = await ownerDocRef.get();

    if (!ownerDocSnap.exists() || ownerDocSnap.data()?.role !== 'owner') {
        return NextResponse.json({ error: 'Permiso denegado: Solo los propietarios pueden eliminar instancias.' }, { status: 403 });
    }

    if (managerDocSnap.exists()) {
        const managerData = managerDocSnap.data();
        if (managerData?.managedBy !== ownerUid) {
          return NextResponse.json({ error: 'Permiso denegado: No tienes permiso para eliminar este usuario.' }, { status: 403 });
        }
        if (managerData?.organizationId !== ownerDocSnap.data()?.organizationId) {
          return NextResponse.json({ error: 'Permiso denegado: Inconsistencia de organización.' }, { status: 403 });
        }
    }
    
    try {
        await adminAuth.deleteUser(managerUid);
        console.log(`Successfully deleted user from Auth: ${managerUid}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.warn(`User ${managerUid} not found in Firebase Auth. Proceeding to delete from Firestore.`);
        } else {
            throw error; // Re-throw other auth errors
        }
    }
    
    if (managerDocSnap.exists()) {
        await managerDocRef.delete();
        console.log(`Successfully deleted user document from Firestore: ${managerUid}`);
    }
    
    return NextResponse.json({ success: true, message: 'La instancia ha sido eliminada permanentemente.' });

  } catch (error: any) {
    console.error('Error in /api/delete-managed-user:', error);
    return NextResponse.json({ error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}

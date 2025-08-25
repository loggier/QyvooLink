
'use server';

import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    // Initialize Firebase Admin SDK inside the request handler
    const adminApp = initializeAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    // 1. Authenticate the request from the owner
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

    // 2. Get the manager's UID from the request body
    const { managerUid } = await req.json();
    if (!managerUid) {
      return NextResponse.json({ error: 'Falta el UID del manager.' }, { status: 400 });
    }

    // 3. Verify that the user being deleted is actually managed by the owner
    const managerDocRef = adminDb.collection('users').doc(managerUid);
    const managerDocSnap = await managerDocRef.get();

    if (!managerDocSnap.exists) {
      // If the document doesn't exist, maybe it was already deleted.
      // We can try to delete the auth user anyway to be sure.
      try {
        await adminAuth.deleteUser(managerUid);
        console.log(`Successfully deleted orphaned auth user: ${managerUid}`);
        return NextResponse.json({ success: true, message: 'La instancia (huérfana) ha sido eliminada.' });
      } catch(authError: any) {
         if (authError.code === 'auth/user-not-found') {
            return NextResponse.json({ error: 'El usuario a eliminar no fue encontrado.' }, { status: 404 });
         }
         throw authError;
      }
    }

    const managerData = managerDocSnap.data();
    // CORRECTED LOGIC: Check if the manager's managedBy field matches the UID of the person making the request.
    if (managerData?.managedBy !== ownerUid) {
      return NextResponse.json({ error: 'Permiso denegado: No tienes permiso para eliminar este usuario.' }, { status: 403 });
    }
    
    // 4. Delete the user from Firebase Authentication
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

    // 5. Delete the user's document from Firestore
    await managerDocRef.delete();
    console.log(`Successfully deleted user document from Firestore: ${managerUid}`);
    
    return NextResponse.json({ success: true, message: 'La instancia ha sido eliminada permanentemente.' });

  } catch (error: any) {
    console.error('Error in /api/delete-managed-user:', error);
    return NextResponse.json({ error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}


'use server';

import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

// This is a placeholder auth object for type inference, the real one is initialized inside POST
const authForTypes = getAuth();
type DecodedIdToken = Awaited<ReturnType<typeof authForTypes.verifyIdToken>>;


async function verifyOwnerPermissions(adminAuth: ReturnType<typeof getAuth>, token: string | undefined | null): Promise<DecodedIdToken> {
    if (!token) {
      throw new Error('No autorizado: Token no proporcionado.');
    }
    try {
        return await adminAuth.verifyIdToken(token);
    } catch (error) {
        console.error('Error verifying ID token:', error);
        throw new Error('No autorizado: Token inválido.');
    }
}


export async function POST(req: Request) {
  try {
    // Initialize Admin SDK on each request to ensure env vars are loaded
    const adminApp = initializeAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    const idToken = req.headers.get('Authorization')?.split('Bearer ')[1];
    const decodedToken = await verifyOwnerPermissions(adminAuth, idToken);
    const ownerUid = decodedToken.uid;

    const { managerUid } = await req.json();
    if (!managerUid) {
      return NextResponse.json({ error: 'Falta el UID del manager.' }, { status: 400 });
    }

    const managerDocRef = adminDb.collection('users').doc(managerUid);
    const managerDocSnap = await managerDocRef.get();
    
    if (managerDocSnap.exists()) {
        const managerData = managerDocSnap.data();
        if (!managerData) {
            return NextResponse.json({ error: 'No se encontraron datos del manager.' }, { status: 404 });
        }
        
        // Security Check 1: Ensure they belong to the same organization
        const ownerDocSnap = await adminDb.collection('users').doc(ownerUid).get();
        if (!ownerDocSnap.exists() || ownerDocSnap.data()?.organizationId !== managerData.organizationId) {
             return NextResponse.json({ error: 'Permiso denegado: No perteneces a la misma organización.' }, { status: 403 });
        }
        
        // Security Check 2: Ensure the requester is the owner of this instance
        if (managerData.managedBy !== ownerUid) {
             return NextResponse.json({ error: 'Permiso denegado: No eres el propietario de esta instancia.' }, { status: 403 });
        }
        
        // Proceed with deletion from Firestore
        await managerDocRef.delete();
        console.log(`Successfully deleted user document from Firestore: ${managerUid}`);
    } else {
        console.warn(`Firestore document for manager ${managerUid} not found. It might have been deleted already.`);
    }
    
    // Deletion from Auth - Temporarily disabled as per user request
    /*
    try {
        await adminAuth.deleteUser(managerUid);
        console.log(`Successfully deleted user from Auth: ${managerUid}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.warn(`User ${managerUid} not found in Firebase Auth. Assuming already deleted.`);
        } else {
            console.error(`Error deleting user from Auth: ${managerUid}`, error);
            // We will not re-throw the error, allowing Firestore deletion to be the primary success factor
        }
    }
    */
    
    return NextResponse.json({ success: true, message: 'La instancia ha sido eliminada de la base de datos.' });

  } catch (error: any) {
    console.error('Error in /api/delete-managed-user:', error);
    return NextResponse.json({ error: 'Ocurrió un error interno en el servidor.', details: error.message }, { status: 500 });
  }
}

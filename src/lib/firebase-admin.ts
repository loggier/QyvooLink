
import * as admin from 'firebase-admin';

// This function ensures that the Firebase Admin SDK is initialized only once.
export function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Check if the required environment variables are set
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    const missingVars = [];
    if (!privateKey) missingVars.push("FIREBASE_PRIVATE_KEY");
    if (!clientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
    if (!projectId) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

    throw new Error(
      `Firebase Admin SDK configuration is missing environment variables: ${missingVars.join(", ")}. ` +
      "The server cannot initialize Firebase Admin without them."
    );
  }

  const credentials = {
    projectId: projectId,
    clientEmail: clientEmail,
    // Replace newline characters with actual newlines - CRITICAL FIX
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };

  return admin.initializeApp({
    credential: admin.credential.cert(credentials),
  });
}

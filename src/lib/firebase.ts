
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, serverTimestamp } from 'firebase/firestore';

// Read Firebase configuration from environment variables
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Check if all required environment variables are set
if (
  !apiKey ||
  !authDomain ||
  !projectId ||
  !storageBucket ||
  !messagingSenderId ||
  !appId
) {
  const missingVars = [];
  if (!apiKey) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain) missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!projectId) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!storageBucket) missingVars.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!messagingSenderId) missingVars.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!appId) missingVars.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  throw new Error(
    `Firebase configuration is missing the following environment variables: ${missingVars.join(", ")}. ` +
    "Please ensure they are set in your .env.local file or deployment environment. " +
    "The app cannot initialize Firebase without them."
  );
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain, 
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db, serverTimestamp };

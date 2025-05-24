
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (!apiKey) {
  // This error will be thrown if the API key is not set, making it clear to the user what's wrong.
  throw new Error(
    "Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing. " +
    "Please ensure it is set in your .env.local file or environment variables. " +
    "The app cannot initialize Firebase without it."
  );
}

// Log warnings for other potentially missing critical variables, but API key is primary for this error.
if (!authDomain) {
  console.warn(
    "Firebase Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) might be missing. " +
    "Please ensure it is set in your environment variables if you encounter further issues."
  );
}
if (!projectId) {
   console.warn(
    "Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) might be missing. " +
    "Please ensure it is set in your environment variables if you encounter further issues."
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

export { app, auth, db };

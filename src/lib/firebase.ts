
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyBM8CyP_FEIhcvqXZmsUaak_CoHGhpwUpw",
  authDomain: "flizochat-web.firebaseapp.com",
  projectId: "flizochat-web",
  storageBucket: "flizochat-web.firebasestorage.app",
  messagingSenderId: "625255658227",
  appId: "1:625255658227:web:21955269c35ddf8f053d86"
};

// Basic check to ensure the hardcoded config looks somewhat complete
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Firebase configuration (apiKey or projectId) is missing in src/lib/firebase.ts. " +
    "Please ensure it is correctly hardcoded. " +
    "Note: Using environment variables is the recommended and more secure approach."
  );
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };

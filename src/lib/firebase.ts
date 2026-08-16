import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: any;
let auth: any;
let googleProvider: any;
let db: any;

try {
  if (!firebaseConfig.apiKey) {
    if (import.meta.env.PROD) {
       throw new Error("FATAL ERROR: Missing Firebase config in production");
    }
    throw new Error("Missing Firebase config");
  }

  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  googleProvider = new GoogleAuthProvider();
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (error) {
  if (import.meta.env.PROD) {
    console.error("FATAL ERROR: Firebase initialization failed in production.");
    throw error; // Fail closed, do not mock
  }
  console.warn("Firebase not configured properly, using mocks.", error);
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => { cb(null); return () => {}; }
  };
  googleProvider = {};
  db = {};
}

export { auth, googleProvider, db };

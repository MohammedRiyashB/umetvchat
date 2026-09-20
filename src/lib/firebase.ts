import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "umetvchat.firebaseapp.com",
  databaseURL: "https://umetvchat-default-rtdb.firebaseio.com",
  projectId: "umetvchat",
  storageBucket: "umetvchat.firebasestorage.app",
  messagingSenderId: "669396250850",
  appId: "1:669396250850:web:080210ea174c4fc023eebb",
  measurementId: "G-WY9Z77E5PY",
};

const app = initializeApp(firebaseConfig);

const appCheck: AppCheck | null = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});
const db = getFirestore(app, "umetvchat");

const googleProvider = new GoogleAuthProvider();

export { app, appCheck, auth, db, googleProvider };

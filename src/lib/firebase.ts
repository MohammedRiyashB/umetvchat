import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, googleProvider, db };

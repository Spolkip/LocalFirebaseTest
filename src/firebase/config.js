// src/config.ts (or config.js)
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Use your existing env vars (unchanged)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Init
const app = initializeApp(firebaseConfig);

// SDK instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// If you deploy/call functions in a specific region, set it here (default is "us-central1")
export const functions = getFunctions(app /*, "us-central1" */);

export const appId = "default-grepolis-clone";

// Route to emulators only in local dev
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // match the ports shown by `firebase emulators:start`
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); // Auth requires http:// scheme
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export default app;

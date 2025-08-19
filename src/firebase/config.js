// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "dummy-auth-domain.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "grepollike",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "dummy-storage-bucket.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender-id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "dummy-app-id",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "dummy-measurement-id"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const appId = "default-grepolis-clone";
// #comment Reverted to checking hostname to reliably detect the local environment.
// This ensures the app connects to emulators when you run `npm start`.
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  console.log("Development environment detected. Connecting to Firebase emulators.");
  // #comment The Auth emulator requires the "http://" prefix, while others do not.
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8090);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export default app;

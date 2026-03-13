import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Replace these placeholder values with your actual Firebase project config.
// Go to https://console.firebase.google.com → Your project → Project settings
// → Your apps → Web app → SDK setup and configuration → Config
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAjB26lTTJyPXE6_88PYBTAZHbXK5chw3M",
  authDomain: "lendtrack-dea5f.firebaseapp.com",
  projectId: "lendtrack-dea5f",
  storageBucket: "lendtrack-dea5f.firebasestorage.app",
  messagingSenderId: "355259328072",
  appId: "1:355259328072:web:8bd37212925b8393595a7d",
  measurementId: "G-FDG0FCP2X1",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;



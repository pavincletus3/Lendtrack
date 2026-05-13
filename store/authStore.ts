import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUserProfile, getUserProfile } from '@/lib/firestore/users';
import type { UserProfile } from '@/types';

// Google Sign-In has native modules not available in Expo Go.
// Lazy-load + configure so the app still boots in Expo Go (email/password login works).
let GoogleSignin: any = null;
function getGoogleSignin() {
  if (GoogleSignin) return GoogleSignin;
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    GoogleSignin.configure({
      webClientId: '355259328072-mhcd6lbgb3mafj2ksdiq0kpsbl9k3eaf.apps.googleusercontent.com',
      offlineAccess: true,
    });
    return GoogleSignin;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  initialize: () => () => void; // returns unsubscribe
}

async function ensureProfile(user: User): Promise<void> {
  const existing = await getUserProfile(user.uid);
  if (!existing) {
    const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'User';
    await createUserProfile(user.uid, user.email ?? '', displayName);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        set({ user, profile, initialized: true });
      } else {
        set({ user: null, profile: null, initialized: true });
      }
    });
    return unsubscribe;
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (email) => {
    await sendPasswordResetEmail(auth, email);
  },

  loginWithGoogle: async () => {
    const gs = getGoogleSignin();
    if (!gs) throw new Error('Google Sign-In is not available in Expo Go. Use a development build.');
    set({ loading: true });
    try {
      await gs.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await gs.signIn();
      if (response.type === 'cancelled') return;
      if (response.type !== 'success') throw new Error('Google Sign-In failed');
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('Google Sign-In failed: no ID token returned');
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await ensureProfile(result.user);
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(cred.user.uid, email, displayName);
      const profile = await getUserProfile(cred.user.uid);
      set({ profile });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await signOut(auth);
    const gs = getGoogleSignin();
    if (gs) {
      try { await gs.signOut(); } catch { /* not signed in with Google */ }
    }
    set({ user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),
}));

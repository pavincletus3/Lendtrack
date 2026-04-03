import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { auth } from '@/lib/firebase';
import { createUserProfile, getUserProfile } from '@/lib/firestore/users';
import type { UserProfile } from '@/types';

GoogleSignin.configure({
  webClientId: "355259328072-mhcd6lbgb3mafj2ksdiq0kpsbl9k3eaf.apps.googleusercontent.com",
  offlineAccess: true,
});

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
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
    set({ loading: true });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
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

  loginWithApple: async () => {
    if (Platform.OS !== 'ios') return;
    set({ loading: true });
    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken } = appleCredential;
      if (!identityToken) throw new Error('Apple Sign-In failed: no identity token');
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken });
      const result = await signInWithCredential(auth, credential);
      if (appleCredential.fullName?.givenName) {
        const displayName = `${appleCredential.fullName.givenName} ${appleCredential.fullName.familyName ?? ''}`.trim();
        await createUserProfile(result.user.uid, result.user.email ?? '', displayName);
      } else {
        await ensureProfile(result.user);
      }
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
    try { await GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
    set({ user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),
}));

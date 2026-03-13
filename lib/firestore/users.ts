import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types';

const COLLECTION = 'users';

export async function createUserProfile(
  userId: string,
  email: string,
  displayName: string
): Promise<void> {
  await setDoc(doc(db, COLLECTION, userId), {
    email,
    displayName,
    language: 'en',
    theme: 'system',
    overdueAlertDays: 5,
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    email: data.email,
    displayName: data.displayName,
    language: data.language ?? 'en',
    theme: data.theme ?? 'system',
    overdueAlertDays: data.overdueAlertDays ?? 5,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'language' | 'theme' | 'overdueAlertDays'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, userId), updates);
}

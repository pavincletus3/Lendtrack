import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan } from '@/types';

const COLLECTION = 'loans';

/** Remove undefined values — Firestore rejects them */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

/** Safely convert a Firestore Timestamp (may be null during pending writes) */
function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts.toDate === 'function') return ts.toDate();
  return new Date(ts);
}

function fromFirestore(id: string, data: Record<string, any>): Loan {
  return {
    id,
    userId: data.userId,
    borrowerName: data.borrowerName,
    borrowerPhone: data.borrowerPhone ?? undefined,
    originalPrincipal: data.originalPrincipal,
    currentPrincipal: data.currentPrincipal,
    interestRate: data.interestRate,
    startDate: toDate(data.startDate),
    cycleType: data.cycleType,
    tenure: data.tenure ?? undefined,
    compoundEnabled: data.compoundEnabled,
    status: data.status,
    closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
    notes: data.notes ?? undefined,
    createdAt: toDate(data.createdAt),
  };
}

export type CreateLoanInput = Omit<Loan, 'id' | 'createdAt' | 'originalPrincipal'> & {
  originalPrincipal: number;
};

export async function createLoan(input: CreateLoanInput): Promise<string> {
  const data = stripUndefined({
    userId: input.userId,
    borrowerName: input.borrowerName,
    borrowerPhone: input.borrowerPhone ?? null,
    originalPrincipal: input.originalPrincipal,
    currentPrincipal: input.currentPrincipal,
    interestRate: input.interestRate,
    startDate: Timestamp.fromDate(new Date(input.startDate)),
    cycleType: input.cycleType,
    tenure: input.tenure ?? null,
    compoundEnabled: input.compoundEnabled,
    status: input.status,
    closedAt: null,
    notes: input.notes ?? null,
    createdAt: serverTimestamp(),
  });
  const ref = await addDoc(collection(db, COLLECTION), data);
  return ref.id;
}

export async function updateLoan(loanId: string, updates: Partial<Loan>): Promise<void> {
  const ref = doc(db, COLLECTION, loanId);
  const data: Record<string, any> = {};
  if (updates.borrowerName !== undefined) data.borrowerName = updates.borrowerName;
  if (updates.currentPrincipal !== undefined) data.currentPrincipal = updates.currentPrincipal;
  if (updates.interestRate !== undefined) data.interestRate = updates.interestRate;
  if (updates.compoundEnabled !== undefined) data.compoundEnabled = updates.compoundEnabled;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.tenure !== undefined) data.tenure = updates.tenure;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.startDate) data.startDate = Timestamp.fromDate(new Date(updates.startDate));
  if (updates.closedAt) data.closedAt = Timestamp.fromDate(new Date(updates.closedAt));
  await updateDoc(ref, data);
}

export async function closeLoan(loanId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, loanId), {
    status: 'closed',
    closedAt: serverTimestamp(),
  });
}

export async function deleteLoan(loanId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, loanId));
}

export async function getLoans(userId: string): Promise<Loan[]> {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

export function subscribeLoans(
  userId: string,
  onUpdate: (loans: Loan[]) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

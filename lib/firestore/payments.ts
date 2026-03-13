import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  doc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment } from '@/types';

const COLLECTION = 'payments';

function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts.toDate === 'function') return ts.toDate();
  return new Date(ts);
}

function fromFirestore(id: string, data: Record<string, any>): Payment {
  return {
    id,
    loanId: data.loanId,
    userId: data.userId,
    month: data.month,
    type: data.type,
    expectedAmount: data.expectedAmount,
    status: data.status,
    paidAt: data.paidAt ? toDate(data.paidAt) : undefined,
    amount: data.amount,
    notes: data.notes ?? undefined,
    createdAt: toDate(data.createdAt),
  };
}

/** Record an interest payment as Paid */
export async function markInterestPaid(
  loanId: string,
  userId: string,
  month: string,
  expectedAmount: number
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    loanId,
    userId,
    month,
    type: 'interest',
    expectedAmount,
    status: 'paid',
    paidAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Defer an interest payment for a month */
export async function markInterestDeferred(
  loanId: string,
  userId: string,
  month: string,
  expectedAmount: number
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    loanId,
    userId,
    month,
    type: 'interest',
    expectedAmount,
    status: 'deferred',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update an existing payment record */
export async function updatePayment(
  paymentId: string,
  updates: Partial<Payment>
): Promise<void> {
  const ref = doc(db, COLLECTION, paymentId);
  const data: Record<string, any> = { ...updates };
  delete data.id;
  delete data.createdAt;
  if (updates.status === 'paid') {
    data.paidAt = serverTimestamp();
  }
  await updateDoc(ref, data);
}

/** Record a principal repayment (partial or full) */
export async function recordPrincipalRepayment(
  loanId: string,
  userId: string,
  amount: number,
  type: 'principal_partial' | 'principal_full',
  notes?: string
): Promise<string> {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const ref = await addDoc(collection(db, COLLECTION), {
    loanId,
    userId,
    month,
    type,
    amount,
    notes: notes ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

export async function getPaymentsForLoan(loanId: string): Promise<Payment[]> {
  const q = query(collection(db, COLLECTION), where('loanId', '==', loanId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

export function subscribePayments(
  userId: string,
  onUpdate: (payments: Payment[]) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

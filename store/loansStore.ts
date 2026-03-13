import { create } from 'zustand';
import { subscribeLoans } from '@/lib/firestore/loans';
import { subscribePayments } from '@/lib/firestore/payments';
import { computeDashboardStats } from '@/lib/calculations';
import type { Loan, Payment, DashboardStats } from '@/types';
import type { Unsubscribe } from 'firebase/firestore';

interface LoansState {
  loans: Loan[];
  payments: Payment[];
  stats: DashboardStats;
  loading: boolean;
  _unsubLoans: Unsubscribe | null;
  _unsubPayments: Unsubscribe | null;
  subscribe: (userId: string, overdueAlertDays?: number) => void;
  unsubscribe: () => void;
}

const emptyStats: DashboardStats = {
  totalPrincipalInRotation: 0,
  totalInterestReceived: 0,
  totalInterestAccrued: 0,
  expectedThisMonth: 0,
  collectedThisMonth: 0,
};

export const useLoansStore = create<LoansState>((set, get) => ({
  loans: [],
  payments: [],
  stats: emptyStats,
  loading: false,
  _unsubLoans: null,
  _unsubPayments: null,

  subscribe: (userId, overdueAlertDays = 5) => {
    set({ loading: true });

    // Local mutable refs so both callbacks can see the latest values
    let loans: Loan[] = [];
    let payments: Payment[] = [];

    const unsubLoans = subscribeLoans(userId, (newLoans) => {
      loans = newLoans;
      set({
        loans: newLoans,
        stats: computeDashboardStats(loans, payments, overdueAlertDays),
        loading: false,
      });
    });

    const unsubPayments = subscribePayments(userId, (newPayments) => {
      payments = newPayments;
      set({
        payments: newPayments,
        stats: computeDashboardStats(loans, payments, overdueAlertDays),
      });
    });

    set({ _unsubLoans: unsubLoans, _unsubPayments: unsubPayments });
  },

  unsubscribe: () => {
    const { _unsubLoans, _unsubPayments } = get();
    _unsubLoans?.();
    _unsubPayments?.();
    set({
      loans: [],
      payments: [],
      stats: emptyStats,
      _unsubLoans: null,
      _unsubPayments: null,
    });
  },
}));

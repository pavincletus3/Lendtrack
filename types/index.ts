export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  language: 'en' | 'ta';
  theme: 'light' | 'dark' | 'system';
  overdueAlertDays: number;
  createdAt: Date;
}

export interface Loan {
  id: string;
  userId: string;
  borrowerName: string;
  borrowerPhone?: string;
  originalPrincipal: number;
  currentPrincipal: number;
  interestRate: number; // % per month (e.g. 2 means 2%)
  startDate: Date;
  cycleType: 'calendar' | 'anniversary';
  tenure?: number; // months, optional
  status: 'active' | 'closed';
  closedAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface Payment {
  id: string;
  loanId: string;
  userId: string;
  month: string; // 'YYYY-MM'
  type: 'interest' | 'principal_partial' | 'principal_full';
  // For interest payments
  expectedAmount?: number;
  paidAmount?: number; // actual amount received (may be < expectedAmount for partial)
  status?: 'paid';
  paidAt?: Date; // user-selected date the borrower actually paid
  // For principal repayments
  amount?: number;
  notes?: string;
  createdAt: Date;
}

export type BadgeStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface MonthSummary {
  month: string; // 'YYYY-MM'
  loanId: string;
  borrowerName: string;
  principal: number;
  expectedInterest: number;
  status: BadgeStatus;
  payment?: Payment;
}

export interface DashboardStats {
  totalPrincipalInRotation: number;
  totalInterestReceived: number;
  totalOutstandingInterest: number;
  expectedThisMonth: number;
  collectedThisMonth: number;
}

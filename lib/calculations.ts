import { format, addMonths, getDate } from 'date-fns';
import type { Loan, Payment, DashboardStats, BadgeStatus } from '@/types';

/** Monthly interest amount for a given principal and rate */
export function monthlyInterest(principal: number, ratePercent: number): number {
  return Math.round((principal * ratePercent) / 100);
}

/** Format a JS Date as 'YYYY-MM' string */
export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

/** Get current month key 'YYYY-MM' */
export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

/**
 * The first month that interest is due for a loan.
 * Interest starts the month AFTER the start date.
 */
export function loanFirstInterestMonth(loan: Loan): string {
  const start = new Date(loan.startDate);
  const firstMonth = addMonths(
    new Date(start.getFullYear(), start.getMonth(), 1),
    1
  );
  return toMonthKey(firstMonth);
}

/** Returns true if the given loan has interest due in the given month. */
export function isDueInMonth(loan: Loan, monthKey: string): boolean {
  if (monthKey < loanFirstInterestMonth(loan)) return false;
  return true;
}

/** Get the due date for a loan's interest in a given month */
export function getDueDate(loan: Loan, monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  if (loan.cycleType === 'calendar') {
    return new Date(year, month, 0);
  }
  const day = getDate(new Date(loan.startDate));
  return new Date(year, month - 1, day);
}

/** Find an interest payment record for a given loan + month */
export function findInterestPayment(loanId: string, monthKey: string, payments: Payment[]): Payment | undefined {
  return payments.find(
    (p) => p.loanId === loanId && p.month === monthKey && p.type === 'interest'
  );
}

/** Get the amount paid for an interest payment (handles legacy records without paidAmount) */
export function paidAmountFor(payment: Payment | undefined): number {
  if (!payment || payment.status !== 'paid') return 0;
  if (typeof payment.paidAmount === 'number') return payment.paidAmount;
  // Legacy record marked 'paid' without explicit paidAmount → treat as fully paid
  return payment.expectedAmount ?? 0;
}

/** Get status badge for a loan in a given month */
export function getLoanMonthStatus(
  loan: Loan,
  monthKey: string,
  payments: Payment[],
  overdueAlertDays = 5
): BadgeStatus {
  if (!isDueInMonth(loan, monthKey)) return 'pending';

  const payment = findInterestPayment(loan.id, monthKey, payments);
  const expected = payment?.expectedAmount ?? monthlyInterest(loan.currentPrincipal, loan.interestRate);
  const paid = paidAmountFor(payment);

  if (paid >= expected && expected > 0) return 'paid';
  if (paid > 0) return 'partial';

  const dueDate = getDueDate(loan, monthKey);
  const overdueThreshold = new Date(dueDate);
  overdueThreshold.setDate(overdueThreshold.getDate() + overdueAlertDays);
  if (new Date() > overdueThreshold) return 'overdue';

  return 'pending';
}

/** Compute dashboard stats from loans and payments */
export function computeDashboardStats(
  loans: Loan[],
  payments: Payment[],
  overdueAlertDays = 5
): DashboardStats {
  const activeLoans = loans.filter((l) => l.status === 'active');
  const monthKey = currentMonthKey();

  const totalPrincipalInRotation = activeLoans.reduce(
    (sum, l) => sum + l.currentPrincipal,
    0
  );

  const interestPayments = payments.filter((p) => p.type === 'interest');

  const totalInterestReceived = interestPayments.reduce(
    (sum, p) => sum + paidAmountFor(p),
    0
  );

  // Outstanding = unpaid portion of expected interest across all months that are due
  let totalOutstandingInterest = 0;
  for (const loan of activeLoans) {
    // Walk every due month from first-interest-month up to current month
    let cursor = new Date(loan.startDate);
    cursor = addMonths(new Date(cursor.getFullYear(), cursor.getMonth(), 1), 1);
    const end = new Date();
    const endStart = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endStart) {
      const mk = toMonthKey(cursor);
      const p = findInterestPayment(loan.id, mk, payments);
      const expected = p?.expectedAmount ?? monthlyInterest(loan.currentPrincipal, loan.interestRate);
      const paid = paidAmountFor(p);
      const owed = Math.max(0, expected - paid);
      totalOutstandingInterest += owed;
      cursor = addMonths(cursor, 1);
    }
  }

  const expectedThisMonth = activeLoans.reduce((sum, loan) => {
    if (!isDueInMonth(loan, monthKey)) return sum;
    return sum + monthlyInterest(loan.currentPrincipal, loan.interestRate);
  }, 0);

  const collectedThisMonth = interestPayments
    .filter((p) => p.month === monthKey)
    .reduce((sum, p) => sum + paidAmountFor(p), 0);

  return {
    totalPrincipalInRotation,
    totalInterestReceived,
    totalOutstandingInterest,
    expectedThisMonth,
    collectedThisMonth,
  };
}

/** Format currency for display (Indian rupee format) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface UnpaidMonth {
  month: string;
  expected: number;
  alreadyPaid: number;
  owed: number;
  paymentId?: string;
}

/** List of months with unpaid interest (oldest first). Includes partials. */
export function getUnpaidInterestMonths(loan: Loan, payments: Payment[]): UnpaidMonth[] {
  const months = getLoanMonths(loan).slice().reverse(); // oldest first
  const result: UnpaidMonth[] = [];
  const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
  for (const month of months) {
    const p = findInterestPayment(loan.id, month, payments);
    const exp = p?.expectedAmount ?? expected;
    const paid = paidAmountFor(p);
    const owed = Math.max(0, exp - paid);
    if (owed > 0) {
      result.push({ month, expected: exp, alreadyPaid: paid, owed, paymentId: p?.id });
    }
  }
  return result;
}

export interface CatchupAllocation {
  month: string;
  expected: number;
  previouslyPaid: number;
  newPaidAmount: number; // total paidAmount to write (previouslyPaid + applied)
  applied: number; // how much of the lump sum was applied to this month
  paymentId?: string;
  fullyPaid: boolean;
}

/** Allocate a lump-sum payment across unpaid months, oldest first. */
export function distributeCatchup(unpaid: UnpaidMonth[], amount: number): {
  allocations: CatchupAllocation[];
  leftover: number;
} {
  let remaining = amount;
  const allocations: CatchupAllocation[] = [];
  for (const u of unpaid) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, u.owed);
    remaining -= applied;
    const newPaidAmount = u.alreadyPaid + applied;
    allocations.push({
      month: u.month,
      expected: u.expected,
      previouslyPaid: u.alreadyPaid,
      newPaidAmount,
      applied,
      paymentId: u.paymentId,
      fullyPaid: newPaidAmount >= u.expected,
    });
  }
  return { allocations, leftover: remaining };
}

/** Get list of month keys from loan's first interest month to current month */
export function getLoanMonths(loan: Loan): string[] {
  const months: string[] = [];
  const firstInterest = loanFirstInterestMonth(loan);
  const [fy, fm] = firstInterest.split('-').map(Number);
  const firstMonth = new Date(fy, fm - 1, 1);

  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), 1);

  let cursor = firstMonth;
  while (cursor <= current) {
    months.push(toMonthKey(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months.reverse();
}

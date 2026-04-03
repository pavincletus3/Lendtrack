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
 * e.g. loan started Feb 3 → first interest month is Mar.
 */
export function loanFirstInterestMonth(loan: Loan): string {
  const start = new Date(loan.startDate);
  const firstMonth = addMonths(
    new Date(start.getFullYear(), start.getMonth(), 1),
    1
  );
  return toMonthKey(firstMonth);
}

/**
 * Returns true if the given loan has interest due in the given month.
 * A loan is never due in its start month or any prior month.
 */
export function isDueInMonth(loan: Loan, monthKey: string): boolean {
  // Never due before interest starts
  if (monthKey < loanFirstInterestMonth(loan)) return false;
  // Calendar cycle: due every month from the first interest month onwards
  if (loan.cycleType === 'calendar') return true;
  // Anniversary cycle: same rule — due every month after the start month
  return true;
}

/** Get the due date for a loan's interest in a given month */
export function getDueDate(loan: Loan, monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  if (loan.cycleType === 'calendar') {
    // Due on last day of month
    return new Date(year, month, 0);
  }
  // Anniversary: due on same day as start date each month
  const day = getDate(new Date(loan.startDate));
  return new Date(year, month - 1, day);
}

/** Get status badge for a loan in a given month */
export function getLoanMonthStatus(
  loan: Loan,
  monthKey: string,
  payments: Payment[],
  overdueAlertDays = 5
): BadgeStatus {
  // No interest due before the first interest month — not applicable
  if (!isDueInMonth(loan, monthKey)) return 'pending';

  const interestPayment = payments.find(
    (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest'
  );

  if (interestPayment?.status === 'paid') return 'paid';
  if (interestPayment?.status === 'deferred') return 'deferred';

  // Check if overdue (only for months that are in the past)
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
  const paidPayments = interestPayments.filter((p) => p.status === 'paid');
  const deferredPayments = interestPayments.filter((p) => p.status === 'deferred');

  const totalInterestReceived = paidPayments.reduce(
    (sum, p) => sum + (p.expectedAmount ?? 0),
    0
  );

  const totalDeferredAccrued = deferredPayments.reduce(
    (sum, p) => sum + (p.expectedAmount ?? 0),
    0
  );
  const totalInterestAccrued = totalInterestReceived + totalDeferredAccrued;

  // Expected this month = only loans whose first interest month ≤ current month
  const expectedThisMonth = activeLoans.reduce((sum, loan) => {
    if (!isDueInMonth(loan, monthKey)) return sum;
    return sum + monthlyInterest(loan.currentPrincipal, loan.interestRate);
  }, 0);

  // Already collected this month
  const collectedThisMonth = payments
    .filter(
      (p) =>
        p.type === 'interest' &&
        p.status === 'paid' &&
        p.month === monthKey
    )
    .reduce((sum, p) => sum + (p.expectedAmount ?? 0), 0);

  return {
    totalPrincipalInRotation,
    totalInterestReceived,
    totalInterestAccrued,
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
  return months.reverse(); // newest first
}

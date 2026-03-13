import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { formatCurrency, monthlyInterest } from './calculations';
import type { Loan, Payment } from '@/types';

const badgeStyle: Record<string, string> = {
  paid: 'background:#10B981;color:#fff',
  deferred: 'background:#60A5FA;color:#fff',
  pending: 'background:#F59E0B;color:#fff',
  overdue: 'background:#EF4444;color:#fff',
};

function statusLabel(status: string, lang: 'en' | 'ta'): string {
  const map: Record<string, Record<string, string>> = {
    paid: { en: 'Paid', ta: 'செலுத்தியது' },
    deferred: { en: 'Deferred', ta: 'ஒத்திவைக்கப்பட்டது' },
    pending: { en: 'Pending', ta: 'நிலுவை' },
    overdue: { en: 'Overdue', ta: 'தாமதம்' },
  };
  return map[status]?.[lang] ?? status;
}

export async function generateBorrowerPDF(
  loan: Loan,
  payments: Payment[],
  lang: 'en' | 'ta' = 'en'
): Promise<void> {
  const interestPayments = payments
    .filter((p) => p.loanId === loan.id && p.type === 'interest')
    .sort((a, b) => a.month.localeCompare(b.month));

  const totalReceived = interestPayments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + (p.expectedAmount ?? 0), 0);

  const totalDeferred = interestPayments
    .filter((p) => p.status === 'deferred')
    .reduce((s, p) => s + (p.expectedAmount ?? 0), 0);

  const rows = interestPayments
    .map((p) => {
      const status = p.status ?? 'pending';
      return `
        <tr>
          <td>${p.month}</td>
          <td style="text-align:right">${formatCurrency(p.expectedAmount ?? 0)}</td>
          <td><span style="padding:2px 8px;border-radius:12px;font-size:12px;${badgeStyle[status]}">${statusLabel(status, lang)}</span></td>
          <td>${p.paidAt ? format(new Date(p.paidAt), 'dd MMM yyyy') : '-'}</td>
          <td>${p.notes ?? ''}</td>
        </tr>`;
    })
    .join('');

  const html = `
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { color: #2563eb; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        .info-item label { font-size: 12px; color: #64748b; display: block; }
        .info-item span { font-weight: bold; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #2563eb; color: white; padding: 8px 12px; text-align: left; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .summary { display: flex; gap: 16px; margin-top: 24px; }
        .summary-box { flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; }
        .summary-box label { font-size: 12px; color: #64748b; display: block; }
        .summary-box span { font-size: 18px; font-weight: bold; color: #2563eb; }
      </style>
    </head>
    <body>
      <h1>LendTrack — Loan Statement</h1>
      <div class="subtitle">Generated on ${format(new Date(), 'dd MMM yyyy')}</div>

      <div class="info-grid">
        <div class="info-item"><label>Borrower</label><span>${loan.borrowerName}</span></div>
        <div class="info-item"><label>${loan.borrowerPhone ? 'Phone' : ' '}</label><span>${loan.borrowerPhone ?? ''}</span></div>
        <div class="info-item"><label>Original Principal</label><span>${formatCurrency(loan.originalPrincipal)}</span></div>
        <div class="info-item"><label>Current Principal</label><span>${formatCurrency(loan.currentPrincipal)}</span></div>
        <div class="info-item"><label>Interest Rate</label><span>${loan.interestRate}% / month</span></div>
        <div class="info-item"><label>Start Date</label><span>${format(new Date(loan.startDate), 'dd MMM yyyy')}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Expected</th>
            <th>Status</th>
            <th>Paid Date</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary">
        <div class="summary-box"><label>Total Received</label><span>${formatCurrency(totalReceived)}</span></div>
        <div class="summary-box"><label>Total Deferred</label><span>${formatCurrency(totalDeferred)}</span></div>
        <div class="summary-box"><label>Outstanding Principal</label><span>${formatCurrency(loan.currentPrincipal)}</span></div>
      </div>
    </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${loan.borrowerName} - Loan Statement`,
  });
}

export async function generateMonthlySummaryPDF(
  loans: Loan[],
  payments: Payment[],
  monthKey: string,
  lang: 'en' | 'ta' = 'en'
): Promise<void> {
  const activeLoans = loans.filter((l) => l.status === 'active');

  let totalExpected = 0;
  let totalCollected = 0;

  const rows = activeLoans
    .map((loan) => {
      const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
      const payment = payments.find(
        (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest'
      );
      const status = payment?.status ?? 'pending';
      totalExpected += expected;
      if (status === 'paid') totalCollected += expected;
      return `
        <tr>
          <td>${loan.borrowerName}</td>
          <td style="text-align:right">${formatCurrency(loan.currentPrincipal)}</td>
          <td style="text-align:right">${formatCurrency(expected)}</td>
          <td><span style="padding:2px 8px;border-radius:12px;font-size:12px;${badgeStyle[status]}">${statusLabel(status, lang)}</span></td>
        </tr>`;
    })
    .join('');

  const html = `
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { color: #2563eb; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #2563eb; color: white; padding: 8px 12px; text-align: left; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .summary { display: flex; gap: 16px; margin-top: 24px; }
        .summary-box { flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; }
        .summary-box label { font-size: 12px; color: #64748b; display: block; }
        .summary-box span { font-size: 18px; font-weight: bold; color: #2563eb; }
      </style>
    </head>
    <body>
      <h1>LendTrack — Monthly Summary</h1>
      <div class="subtitle">Month: ${monthKey} &nbsp;|&nbsp; Generated: ${format(new Date(), 'dd MMM yyyy')}</div>

      <table>
        <thead>
          <tr><th>Borrower</th><th>Principal</th><th>Expected Interest</th><th>Status</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary">
        <div class="summary-box"><label>Total Expected</label><span>${formatCurrency(totalExpected)}</span></div>
        <div class="summary-box"><label>Collected</label><span>${formatCurrency(totalCollected)}</span></div>
        <div class="summary-box"><label>Remaining</label><span>${formatCurrency(totalExpected - totalCollected)}</span></div>
      </div>
    </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Monthly Summary - ${monthKey}`,
  });
}

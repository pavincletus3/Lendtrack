import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { useLoansStore } from '@/store/loansStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  monthlyInterest,
  toMonthKey,
  loanFirstInterestMonth,
  paidAmountFor,
  findInterestPayment,
} from '@/lib/calculations';
import { markInterestPaid, deletePayment, bulkMarkInterestPaid } from '@/lib/firestore/payments';
import { generateMonthlySummaryPDF } from '@/lib/pdf';
import { PaymentEntryModal } from '@/components/PaymentEntryModal';
import { triggerHaptic } from '@/lib/haptics';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { PageHeader, Card, ListRow, ConfirmSheet, PrimaryButton } from '@/components/ui';
import type { BadgeStatus, Payment } from '@/types';

export default function MonthlyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const BADGE: Record<BadgeStatus, string> = {
    paid: colors.success,
    partial: colors.partial,
    pending: colors.warning,
    overdue: colors.danger,
  };
  const user = useAuthStore((s) => s.user);
  const { loans, payments: rawPayments } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const language = useSettingsStore((s) => s.language);
  const hiddenPaymentIds = useUiStore((s) => s.hiddenPaymentIds);
  const hiddenLoanIds = useUiStore((s) => s.hiddenLoanIds);
  const showUndoableAction = useUiStore((s) => s.showUndoableAction);
  const showMessage = useUiStore((s) => s.showMessage);

  const payments = useMemo(
    () => rawPayments.filter((p) => !hiddenPaymentIds[p.id]),
    [rawPayments, hiddenPaymentIds]
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [modalLoanId, setModalLoanId] = useState<string | null>(null);
  const [confirmAllPaid, setConfirmAllPaid] = useState(false);

  const monthKey = toMonthKey(currentDate);
  const activeLoans = loans.filter(
    (l) => !hiddenLoanIds[l.id] && l.status === 'active' && monthKey >= loanFirstInterestMonth(l)
  );

  const totalExpected = activeLoans.reduce(
    (sum, l) => sum + monthlyInterest(l.currentPrincipal, l.interestRate),
    0
  );
  const collectedThisMonth = payments
    .filter((p) => p.type === 'interest' && p.month === monthKey)
    .reduce((sum, p) => sum + paidAmountFor(p), 0);
  const remaining = Math.max(0, totalExpected - collectedThisMonth);
  const isCurrentMonth = monthKey === toMonthKey(new Date());

  const unpaidCount = activeLoans.reduce((count, loan) => {
    const p = findInterestPayment(loan.id, monthKey, payments);
    const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    return paidAmountFor(p) < expected ? count + 1 : count;
  }, 0);

  const modalLoan = modalLoanId ? activeLoans.find((l) => l.id === modalLoanId) : undefined;
  const modalPayment = modalLoan ? findInterestPayment(modalLoan.id, monthKey, payments) : undefined;
  const modalExpected = modalLoan ? monthlyInterest(modalLoan.currentPrincipal, modalLoan.interestRate) : 0;
  const modalMonthLabel = format(currentDate, 'MMMM yyyy');

  async function handleSavePayment(data: { paidAmount: number; paidAt: Date; notes?: string }) {
    if (!modalLoan) return;
    await markInterestPaid(
      {
        loanId: modalLoan.id,
        userId: user!.uid,
        month: monthKey,
        expectedAmount: modalPayment?.expectedAmount ?? modalExpected,
        paidAmount: data.paidAmount,
        paidAt: data.paidAt,
        notes: data.notes,
      },
      modalPayment?.id
    );
  }

  function handleDeletePaymentWithUndo(payment: Payment) {
    showUndoableAction({
      message: t('payment.unmarked'),
      actionLabel: t('common.undo'),
      hidePaymentIds: [payment.id],
      onCommit: () => deletePayment(payment.id),
    });
  }

  async function handleLongPressLoan(loan: typeof activeLoans[number]) {
    const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    const existing = findInterestPayment(loan.id, monthKey, payments);
    const alreadyFullyPaid = existing?.status === 'paid' && paidAmountFor(existing) >= expected;
    if (alreadyFullyPaid) return;
    triggerHaptic('medium');
    try {
      await markInterestPaid(
        {
          loanId: loan.id,
          userId: user!.uid,
          month: monthKey,
          expectedAmount: existing?.expectedAmount ?? expected,
          paidAmount: expected,
          paidAt: new Date(),
        },
        existing?.id
      );
      showMessage(t('payment.markedPaid'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleBulkMarkAllPaid() {
    const unpaidLoans = activeLoans.filter((loan) => {
      const p = findInterestPayment(loan.id, monthKey, payments);
      const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
      return paidAmountFor(p) < expected;
    });
    if (unpaidLoans.length === 0) {
      Alert.alert('All Done', 'All loans for this month are already marked as paid.');
      return;
    }
    setConfirmAllPaid(true);
  }

  async function commitBulkMarkAllPaid() {
    const unpaidLoans = activeLoans.filter((loan) => {
      const p = findInterestPayment(loan.id, monthKey, payments);
      const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
      return paidAmountFor(p) < expected;
    });
    setBusy(true);
    try {
      const items = unpaidLoans.map((loan) => ({
        loanId: loan.id,
        userId: user!.uid,
        month: monthKey,
        expectedAmount: monthlyInterest(loan.currentPrincipal, loan.interestRate),
      }));
      await bulkMarkInterestPaid(items, payments);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      await generateMonthlySummaryPDF(loans, payments, monthKey, language as 'en' | 'ta');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      <PaymentEntryModal
        visible={!!modalLoanId}
        mode={modalPayment?.status === 'paid' ? 'edit' : 'create'}
        monthLabel={modalLoan ? `${modalLoan.borrowerName} — ${modalMonthLabel}` : modalMonthLabel}
        expectedAmount={modalPayment?.expectedAmount ?? modalExpected}
        defaultAmount={modalPayment ? paidAmountFor(modalPayment) || undefined : undefined}
        defaultDate={modalPayment?.paidAt}
        defaultNotes={modalPayment?.notes}
        onClose={() => setModalLoanId(null)}
        onSave={handleSavePayment}
        onDelete={
          modalPayment?.status === 'paid'
            ? () => {
                const p = modalPayment;
                if (p) handleDeletePaymentWithUndo(p);
              }
            : undefined
        }
      />

      <ConfirmSheet
        visible={confirmAllPaid}
        title={t('payment.markAllPaid')}
        message={t('payment.markAllConfirm')}
        confirmLabel={t('common.confirm')}
        icon="checkmark-done-outline"
        tone="primary"
        onClose={() => setConfirmAllPaid(false)}
        onConfirm={commitBulkMarkAllPaid}
      />

      <PageHeader
        title={t('monthly.title')}
        right={
          <TouchableOpacity onPress={handleExport} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 140, gap: Spacing.md }}>
        {/* Month navigator */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[Type.titleLg, { color: colors.text }]}>{format(currentDate, 'MMMM yyyy')}</Text>
            {isCurrentMonth && (
              <Text style={[Type.micro, { color: colors.primary, marginTop: 2 }]}>
                {t('monthly.currentMonthNote')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => !isCurrentMonth && setCurrentDate(addMonths(currentDate, 1))}
            style={[s.navBtn, isCurrentMonth && { opacity: 0.3 }]}
            disabled={isCurrentMonth}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <Card padding={20} radius={Radius.xxl}>
            <Text style={[Type.caption, { color: colors.textMuted }]}>
              Expected this month
            </Text>
            <Text style={[Type.heroXL, { color: colors.text, marginTop: 4 }]}>
              {formatCurrency(totalExpected)}
            </Text>
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={[Type.micro, { color: colors.textMuted }]}>COLLECTED</Text>
                <Text style={[Type.title, { color: colors.success, marginTop: 2 }]}>
                  {formatCurrency(collectedThisMonth)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[Type.micro, { color: colors.textMuted }]}>REMAINING</Text>
                <Text style={[Type.title, { color: remaining > 0 ? colors.warning : colors.success, marginTop: 2 }]}>
                  {formatCurrency(remaining)}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Mark all paid pill — only when there are unpaid loans this month */}
        {unpaidCount > 0 && (
          <View style={{ paddingHorizontal: Spacing.xl }}>
            <PrimaryButton
              label={`${t('payment.markAllPaid')} (${unpaidCount})`}
              icon="checkmark-done-outline"
              onPress={handleBulkMarkAllPaid}
              disabled={busy}
              variant="secondary"
              fullWidth
            />
          </View>
        )}

        {/* Legend */}
        <View style={s.legendRow}>
          {(['paid', 'partial', 'pending', 'overdue'] as BadgeStatus[]).map((key) => (
            <View key={key} style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: BADGE[key] }]} />
              <Text style={[Type.micro, { color: colors.textMuted }]}>{t(`payment.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Loan list */}
        {activeLoans.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>📋</Text>
            <Text style={[Type.bodyBold, { color: colors.text, marginTop: Spacing.sm }]}>
              {t('monthly.noLoans')}
            </Text>
          </View>
        ) : (
          activeLoans.map((loan, idx) => {
            const status = getLoanMonthStatus(loan, monthKey, payments, overdueAlertDays);
            const payment = findInterestPayment(loan.id, monthKey, payments);
            const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
            const paid = paidAmountFor(payment);
            const hasRecord = payment?.status === 'paid';
            const displayAmount = hasRecord ? paid : monthly;
            return (
              <View key={loan.id}>
                <ListRow
                  name={loan.borrowerName}
                  sublabel={
                    status === 'partial'
                      ? `${formatCurrency(paid)} / ${formatCurrency(monthly)}`
                      : formatCurrency(monthly)
                  }
                  amount={t(`payment.${status}`).toUpperCase()}
                  amountColor={BADGE[status]}
                  amountSub={hasRecord && status === 'paid' ? formatCurrency(displayAmount) : undefined}
                  onPress={() => setModalLoanId(loan.id)}
                  onLongPress={() => handleLongPressLoan(loan)}
                />
                {idx < activeLoans.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 80 }} />
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
    },
    navBtn: { padding: 8 },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.lg },
    legendRow: {
      flexDirection: 'row',
      gap: Spacing.lg,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.sm,
      flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    empty: { alignItems: 'center', paddingVertical: 60 },
  });

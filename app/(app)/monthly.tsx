import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { useLoansStore } from '@/store/loansStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
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
import type { BadgeStatus, Loan } from '@/types';

const BADGE_COLORS: Record<BadgeStatus, string> = {
  paid: '#10B981',
  partial: '#A78BFA',
  pending: '#F59E0B',
  overdue: '#EF4444',
};

const LEGEND: Array<{ key: BadgeStatus; color: string }> = [
  { key: 'paid', color: '#10B981' },
  { key: 'partial', color: '#A78BFA' },
  { key: 'pending', color: '#F59E0B' },
  { key: 'overdue', color: '#EF4444' },
];

export default function MonthlyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { loans, payments } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const language = useSettingsStore((s) => s.language);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [exportLoading, setExportLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [modalLoanId, setModalLoanId] = useState<string | null>(null);

  const monthKey = toMonthKey(currentDate);
  const activeLoans = loans.filter(
    (l) => l.status === 'active' && monthKey >= loanFirstInterestMonth(l)
  );

  const totalExpected = activeLoans.reduce(
    (sum, l) => sum + monthlyInterest(l.currentPrincipal, l.interestRate),
    0
  );
  const collectedThisMonth = payments
    .filter((p) => p.type === 'interest' && p.month === monthKey)
    .reduce((sum, p) => sum + paidAmountFor(p), 0);

  const isCurrentMonth = monthKey === toMonthKey(new Date());

  function prevMonth() { setCurrentDate(subMonths(currentDate, 1)); }
  function nextMonth() { if (!isCurrentMonth) setCurrentDate(addMonths(currentDate, 1)); }

  const modalLoan = modalLoanId ? activeLoans.find((l) => l.id === modalLoanId) : undefined;
  const modalPayment = modalLoan ? findInterestPayment(modalLoan.id, monthKey, payments) : undefined;
  const modalExpected = modalLoan ? monthlyInterest(modalLoan.currentPrincipal, modalLoan.interestRate) : 0;

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

  async function handleDeletePayment() {
    if (modalPayment) await deletePayment(modalPayment.id);
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

    Alert.alert(t('payment.markAllPaid'), t('payment.markAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          setBulkLoading(true);
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
            setBulkLoading(false);
          }
        },
      },
    ]);
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      await generateMonthlySummaryPDF(loans, payments, monthKey, language as 'en' | 'ta');
      Alert.alert('Done', t('payment.exportSuccess'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setExportLoading(false);
    }
  }

  const modalMonthLabel = format(currentDate, 'MMMM yyyy');

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
        onDelete={modalPayment?.status === 'paid' ? handleDeletePayment : undefined}
      />

      {/* Month Picker */}
      <View style={s.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={s.monthArrow}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.monthLabel}>{format(currentDate, 'MMMM yyyy')}</Text>
          {isCurrentMonth && (
            <Text style={s.currentMonthNote}>{t('monthly.currentMonthNote')}</Text>
          )}
        </View>
        <TouchableOpacity onPress={nextMonth} style={s.monthArrow} disabled={isCurrentMonth}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentMonth ? colors.border : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Summary Bar */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{formatCurrency(totalExpected)}</Text>
          <Text style={s.summaryLabel}>Expected</Text>
        </View>
        <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryValue, { color: colors.success }]}>{formatCurrency(collectedThisMonth)}</Text>
          <Text style={s.summaryLabel}>Collected</Text>
        </View>
        <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryValue, { color: colors.warning }]}>
            {formatCurrency(Math.max(0, totalExpected - collectedThisMonth))}
          </Text>
          <Text style={s.summaryLabel}>Remaining</Text>
        </View>
        <View style={s.summaryActions}>
          <TouchableOpacity
            style={s.summaryActionBtn}
            onPress={handleBulkMarkAllPaid}
            disabled={bulkLoading}
          >
            {bulkLoading
              ? <ActivityIndicator size="small" color={colors.success} />
              : <Ionicons name="checkmark-done-outline" size={20} color={colors.success} />
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.summaryActionBtn} onPress={handleExport} disabled={exportLoading}>
            {exportLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="share-outline" size={20} color={colors.primary} />
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Legend */}
      <View style={s.legendRow}>
        {LEGEND.map(({ key, color }) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{t(`payment.${key}`)}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {activeLoans.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>{t('monthly.noLoans')}</Text>
          </View>
        ) : (
          activeLoans.map((loan) => {
            const status = getLoanMonthStatus(loan, monthKey, payments, overdueAlertDays);
            const payment = findInterestPayment(loan.id, monthKey, payments);
            const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
            const paid = paidAmountFor(payment);
            const hasRecord = payment?.status === 'paid';

            return (
              <TouchableOpacity
                key={loan.id}
                style={s.card}
                onPress={() => setModalLoanId(loan.id)}
                activeOpacity={0.7}
              >
                <View style={s.cardLeft}>
                  <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[s.avatarText, { color: colors.primary }]}>
                      {loan.borrowerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.name}>{loan.borrowerName}</Text>
                    <Text style={[s.amount, { color: colors.primary }]}>
                      {hasRecord ? formatCurrency(paid) : formatCurrency(monthly)}
                      {status === 'partial' && (
                        <Text style={[s.amount, { color: colors.warning, fontSize: 12 }]}>
                          {' '}/ {formatCurrency(monthly)}
                        </Text>
                      )}
                    </Text>
                    <View style={[s.statusDot, { backgroundColor: BADGE_COLORS[status] }]}>
                      <Text style={s.statusText}>{t(`payment.${status}`).toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.cardActions}>
                  {!hasRecord && (
                    <View style={[s.actionBtn, { backgroundColor: colors.success }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                  {hasRecord && (
                    <View style={[s.actionBtn, { backgroundColor: BADGE_COLORS[status] + '22' }]}>
                      <Ionicons
                        name={status === 'partial' ? 'time-outline' : 'checkmark-circle'}
                        size={16}
                        color={BADGE_COLORS[status]}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
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
    monthPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    monthArrow: { padding: 8 },
    monthLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
    currentMonthNote: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    summaryBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: 15, fontWeight: '800', color: colors.text },
    summaryLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    summaryDivider: { width: 1, height: 36, marginHorizontal: 4 },
    summaryActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
    summaryActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    list: { padding: 16, gap: 12, paddingBottom: 32 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyIcon: { fontSize: 40 },
    emptyText: { fontSize: 15, color: colors.textMuted },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    amount: { fontSize: 16, fontWeight: '800', marginTop: 2 },
    statusDot: {
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    statusText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    cardActions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

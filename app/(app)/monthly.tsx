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
} from '@/lib/calculations';
import { markInterestPaid, markInterestDeferred, updatePayment, bulkMarkInterestPaid } from '@/lib/firestore/payments';
import { updateLoan } from '@/lib/firestore/loans';
import { generateMonthlySummaryPDF } from '@/lib/pdf';
import type { BadgeStatus, Loan, Payment } from '@/types';

const BADGE_COLORS: Record<BadgeStatus, string> = {
  paid: '#10B981',
  pending: '#F59E0B',
  deferred: '#60A5FA',
  overdue: '#EF4444',
};

const LEGEND: Array<{ key: BadgeStatus; color: string }> = [
  { key: 'paid', color: '#10B981' },
  { key: 'pending', color: '#F59E0B' },
  { key: 'deferred', color: '#60A5FA' },
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const monthKey = toMonthKey(currentDate);
  const activeLoans = loans.filter(
    (l) => l.status === 'active' && monthKey >= loanFirstInterestMonth(l)
  );

  const totalExpected = activeLoans.reduce(
    (sum, l) => sum + monthlyInterest(l.currentPrincipal, l.interestRate),
    0
  );
  const collectedThisMonth = payments
    .filter((p) => p.type === 'interest' && p.status === 'paid' && p.month === monthKey)
    .reduce((sum, p) => sum + (p.expectedAmount ?? 0), 0);

  function prevMonth() { setCurrentDate(subMonths(currentDate, 1)); }
  function nextMonth() {
    if (!isCurrentMonth) setCurrentDate(addMonths(currentDate, 1));
  }
  const isCurrentMonth = monthKey === toMonthKey(new Date());

  async function handlePaid(loan: Loan) {
    const existing = payments.find(
      (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest'
    );
    const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    setActionLoading(loan.id + '-paid');
    try {
      if (existing) {
        await updatePayment(existing.id, { status: 'paid' });
      } else {
        await markInterestPaid(loan.id, user!.uid, monthKey, monthly);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDefer(loan: Loan) {
    const existing = payments.find(
      (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest'
    );
    const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    setActionLoading(loan.id + '-defer');
    try {
      if (existing) {
        await updatePayment(existing.id, { status: 'deferred' });
      } else {
        await markInterestDeferred(loan.id, user!.uid, monthKey, monthly);
        if (loan.compoundEnabled) {
          await updateLoan(loan.id, { currentPrincipal: loan.currentPrincipal + monthly });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBulkMarkAllPaid() {
    const unpaidLoans = activeLoans.filter((loan) => {
      const existing = payments.find(
        (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest' && p.status === 'paid'
      );
      return !existing;
    });

    if (unpaidLoans.length === 0) {
      Alert.alert('All Done', 'All loans for this month are already marked as paid.');
      return;
    }

    Alert.alert(
      t('payment.markAllPaid'),
      t('payment.markAllConfirm'),
      [
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
      ]
    );
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

  const s = styles(colors);

  return (
    <View style={s.container}>
      {/* Month Picker */}
      <View style={s.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={s.monthArrow}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.monthLabel}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          {isCurrentMonth && (
            <Text style={s.currentMonthNote}>{t('monthly.currentMonthNote')}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={nextMonth}
          style={s.monthArrow}
          disabled={isCurrentMonth}
        >
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
          {/* Bulk mark all paid */}
          <TouchableOpacity
            style={s.summaryActionBtn}
            onPress={handleBulkMarkAllPaid}
            disabled={bulkLoading || !!actionLoading}
          >
            {bulkLoading
              ? <ActivityIndicator size="small" color={colors.success} />
              : <Ionicons name="checkmark-done-outline" size={20} color={colors.success} />
            }
          </TouchableOpacity>
          {/* Export PDF */}
          <TouchableOpacity
            style={s.summaryActionBtn}
            onPress={handleExport}
            disabled={exportLoading}
          >
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
            const loanPayments = payments.filter((p) => p.loanId === loan.id);
            const status = getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays);
            const payment = payments.find(
              (p) => p.loanId === loan.id && p.month === monthKey && p.type === 'interest'
            );
            const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
            const isPaid = status === 'paid';
            const isDeferred = status === 'deferred';
            const isLoadingPaid = actionLoading === loan.id + '-paid';
            const isLoadingDefer = actionLoading === loan.id + '-defer';

            return (
              <View key={loan.id} style={s.card}>
                <View style={s.cardLeft}>
                  <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[s.avatarText, { color: colors.primary }]}>
                      {loan.borrowerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.name}>{loan.borrowerName}</Text>
                    <Text style={[s.amount, { color: colors.primary }]}>
                      {formatCurrency(monthly)}
                    </Text>
                    <View style={[s.statusDot, { backgroundColor: BADGE_COLORS[status] }]}>
                      <Text style={s.statusText}>{t(`payment.${status}`).toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.cardActions}>
                  {!isPaid && !isDeferred && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.success }]}
                      onPress={() => handlePaid(loan)}
                      disabled={!!actionLoading || bulkLoading}
                    >
                      {isLoadingPaid
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="checkmark" size={16} color="#fff" />
                      }
                    </TouchableOpacity>
                  )}
                  {isPaid && (
                    <View style={[s.actionBtn, { backgroundColor: colors.success + '22' }]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    </View>
                  )}
                  {!isPaid && !isDeferred && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.info + '22', borderWidth: 1, borderColor: colors.info }]}
                      onPress={() => handleDefer(loan)}
                      disabled={!!actionLoading || bulkLoading}
                    >
                      {isLoadingDefer
                        ? <ActivityIndicator size="small" color={colors.info} />
                        : <Ionicons name="time-outline" size={16} color={colors.info} />
                      }
                    </TouchableOpacity>
                  )}
                  {isDeferred && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.success }]}
                      onPress={() => handlePaid(loan)}
                      disabled={!!actionLoading || bulkLoading}
                    >
                      {isLoadingPaid
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="checkmark" size={16} color="#fff" />
                      }
                    </TouchableOpacity>
                  )}
                </View>
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

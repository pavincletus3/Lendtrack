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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLoansStore } from '@/store/loansStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  getLoanMonths,
  monthlyInterest,
} from '@/lib/calculations';
import { markInterestPaid, markInterestDeferred, updatePayment } from '@/lib/firestore/payments';
import { updateLoan, closeLoan } from '@/lib/firestore/loans';
import { generateBorrowerPDF } from '@/lib/pdf';
import type { BadgeStatus, Payment } from '@/types';

const BADGE_COLORS: Record<BadgeStatus, string> = {
  paid: '#10B981',
  pending: '#F59E0B',
  deferred: '#60A5FA',
  overdue: '#EF4444',
};

export default function BorrowerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // Select stable references — avoid inline filter/find inside selectors (causes Zustand snapshot loop)
  const loans = useLoansStore((s) => s.loans);
  const allPayments = useLoansStore((s) => s.payments);
  const loan = loans.find((l) => l.id === id);
  const payments = allPayments.filter((p) => p.loanId === id);
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const language = useSettingsStore((s) => s.language);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  // Toggle compound mode inline
  const [showCompoundToggle, setShowCompoundToggle] = useState(false);

  if (!loan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const months = getLoanMonths(loan);
  const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
  const s = styles(colors);

  async function handleMarkPaid(month: string, existingPayment?: Payment) {
    setActionLoading(month + '-paid');
    try {
      if (existingPayment) {
        await updatePayment(existingPayment.id, { status: 'paid' });
      } else {
        await markInterestPaid(loan!.id, user!.uid, month, monthly);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDefer(month: string, existingPayment?: Payment) {
    setActionLoading(month + '-defer');
    try {
      if (existingPayment) {
        await updatePayment(existingPayment.id, { status: 'deferred' });
      } else {
        await markInterestDeferred(loan!.id, user!.uid, month, monthly);
        // If compound is enabled, add deferred amount to principal
        if (loan!.compoundEnabled) {
          const newPrincipal = loan!.currentPrincipal + monthly;
          await updateLoan(loan!.id, { currentPrincipal: newPrincipal });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCloseLoan() {
    Alert.alert(
      t('borrowers.close'),
      t('borrowers.closeConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await closeLoan(loan!.id);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleExportPDF() {
    setExportLoading(true);
    try {
      await generateBorrowerPDF(loan!, payments, language as 'en' | 'ta');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{loan.borrowerName}</Text>
        <TouchableOpacity onPress={handleExportPDF} style={s.pdfBtn}>
          {exportLoading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Loan Summary Card */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <SummaryItem label={t('borrowers.currentPrincipal')} value={formatCurrency(loan.currentPrincipal)} accent={colors.primary} colors={colors} />
            <SummaryItem label={t('payment.expectedInterest')} value={formatCurrency(monthly)} accent={colors.success} colors={colors} />
            <SummaryItem label={`${loan.interestRate}% ${t('common.perMonth')}`} value={`${loan.interestRate * 12}% ${t('common.pa')}`} accent={colors.info} colors={colors} />
          </View>

          <View style={s.summaryMeta}>
            <Text style={s.metaText}>
              <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />{' '}
              {t('borrowers.startDate')}: {format(new Date(loan.startDate), 'dd MMM yyyy')}
            </Text>
            <Text style={s.metaText}>
              {loan.cycleType === 'calendar' ? t('borrowers.calendar') : t('borrowers.anniversary')}
            </Text>
            {loan.tenure && (
              <Text style={s.metaText}>
                {t('borrowers.tenure')}: {loan.tenure} {t('borrowers.months')}
              </Text>
            )}
          </View>

          {/* Compound badge */}
          <View style={s.compoundRow}>
            <Ionicons
              name={loan.compoundEnabled ? 'git-merge-outline' : 'remove-circle-outline'}
              size={14}
              color={loan.compoundEnabled ? colors.warning : colors.textMuted}
            />
            <Text style={[s.compoundText, { color: loan.compoundEnabled ? colors.warning : colors.textMuted }]}>
              {loan.compoundEnabled ? t('payment.compoundNote') : t('payment.simpleNote')}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/(app)/borrowers/${loan.id}/repay`)}
            >
              <Ionicons name="arrow-down-circle-outline" size={16} color="#fff" />
              <Text style={s.actionBtnText}>{t('borrowers.repayPrincipal')}</Text>
            </TouchableOpacity>
            {loan.status === 'active' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.danger + '22', borderWidth: 1, borderColor: colors.danger }]}
                onPress={handleCloseLoan}
              >
                <Ionicons name="lock-closed-outline" size={16} color={colors.danger} />
                <Text style={[s.actionBtnText, { color: colors.danger }]}>{t('borrowers.close')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Monthly Timeline */}
        <Text style={s.timelineTitle}>Payment History</Text>

        {months.map((month) => {
          const loanPayments = payments.filter((p) => p.loanId === loan.id);
          const status = getLoanMonthStatus(loan, month, loanPayments, overdueAlertDays);
          const payment = payments.find(
            (p) => p.loanId === loan.id && p.month === month && p.type === 'interest'
          );
          const isPaid = status === 'paid';
          const isDeferred = status === 'deferred';
          const isLoadingPaid = actionLoading === month + '-paid';
          const isLoadingDefer = actionLoading === month + '-defer';

          const [year, mo] = month.split('-');
          const monthLabel = new Date(parseInt(year), parseInt(mo) - 1, 1)
            .toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', { month: 'long', year: 'numeric' });

          return (
            <View key={month} style={s.monthRow}>
              <View style={s.monthLeft}>
                <View style={[s.monthDot, { backgroundColor: BADGE_COLORS[status] }]} />
                <View>
                  <Text style={s.monthLabel}>{monthLabel}</Text>
                  <Text style={[s.monthAmount, { color: colors.primary }]}>
                    {formatCurrency(monthly)}
                  </Text>
                  {isPaid && payment?.paidAt && (
                    <Text style={s.monthMeta}>
                      {t('payment.paidOn')}: {format(new Date(payment.paidAt), 'dd MMM')}
                    </Text>
                  )}
                  {isDeferred && (
                    <Text style={[s.monthMeta, { color: colors.warning }]}>
                      {t('payment.deferred')}
                      {loan.compoundEnabled ? ' → added to principal' : ''}
                    </Text>
                  )}
                </View>
              </View>

              <View style={s.monthActions}>
                {!isPaid && (
                  <TouchableOpacity
                    style={[s.monthBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleMarkPaid(month, payment)}
                    disabled={!!actionLoading}
                  >
                    {isLoadingPaid
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="checkmark" size={16} color="#fff" />
                    }
                    <Text style={s.monthBtnText}>{t('payment.markPaid')}</Text>
                  </TouchableOpacity>
                )}
                {isPaid && (
                  <View style={[s.monthBadge, { backgroundColor: colors.success + '22' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[s.monthBadgeText, { color: colors.success }]}>{t('payment.paid')}</Text>
                  </View>
                )}
                {!isDeferred && !isPaid && loan.status === 'active' && (
                  <TouchableOpacity
                    style={[s.monthBtn, { backgroundColor: colors.info + '22', borderWidth: 1, borderColor: colors.info }]}
                    onPress={() => handleDefer(month, payment)}
                    disabled={!!actionLoading}
                  >
                    {isLoadingDefer
                      ? <ActivityIndicator size="small" color={colors.info} />
                      : <Ionicons name="time-outline" size={16} color={colors.info} />
                    }
                    <Text style={[s.monthBtnText, { color: colors.info }]}>{t('payment.defer')}</Text>
                  </TouchableOpacity>
                )}
                {isDeferred && (
                  <TouchableOpacity
                    style={[s.monthBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleMarkPaid(month, payment)}
                    disabled={!!actionLoading}
                  >
                    {isLoadingPaid
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="checkmark" size={16} color="#fff" />
                    }
                    <Text style={s.monthBtnText}>{t('payment.markPaid')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {months.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyText}>No payment months yet. Interest begins from the month after the start date.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryItem({ label, value, accent, colors }: {
  label: string; value: string; accent: string; colors: any;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: accent }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: 56,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
    pdfBtn: { width: 40, alignItems: 'flex-end' },
    scroll: { padding: 16, paddingBottom: 40, gap: 12 },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryMeta: { gap: 4 },
    metaText: { fontSize: 12, color: colors.textMuted },
    compoundRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    compoundText: { fontSize: 11, flex: 1 },
    actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 6,
    },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    timelineTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
    monthRow: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    monthLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
    monthDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    monthLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    monthAmount: { fontSize: 16, fontWeight: '800', marginTop: 2 },
    monthMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    monthActions: { flexDirection: 'column', gap: 6 },
    monthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 12,
      gap: 5,
    },
    monthBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    monthBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 12,
      gap: 5,
    },
    monthBadgeText: { fontWeight: '700', fontSize: 12 },
    empty: { padding: 24, alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  });

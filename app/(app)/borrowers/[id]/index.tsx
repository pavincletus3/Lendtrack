import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
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
import { updateLoan, closeLoan, reopenLoan, deleteLoan } from '@/lib/firestore/loans';
import { generateBorrowerPDF } from '@/lib/pdf';
import type { BadgeStatus, Payment } from '@/types';

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

export default function BorrowerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loans = useLoansStore((s) => s.loans);
  const allPayments = useLoansStore((s) => s.payments);
  const loan = loans.find((l) => l.id === id);
  const payments = allPayments.filter((p) => p.loanId === id);
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const language = useSettingsStore((s) => s.language);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Must be before any early return to satisfy Rules of Hooks
  const months = useMemo(() => loan ? getLoanMonths(loan) : [], [loan?.id, loan?.startDate?.toString()]);

  if (!loan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);

  const principalPayments = payments
    .filter((p) => p.type === 'principal_partial' || p.type === 'principal_full')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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

  async function handleReopenLoan() {
    Alert.alert(
      t('borrowers.reopen'),
      t('borrowers.reopenConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              await reopenLoan(loan!.id);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleDeleteLoan() {
    Alert.alert(
      'Delete Loan',
      `Permanently delete "${loan!.borrowerName}"? This cannot be undone.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLoan(loan!.id, user!.uid);
              router.replace('/(app)/borrowers');
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
      Alert.alert('Done', t('payment.exportSuccess'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setExportLoading(false);
    }
  }

  function handleCall() {
    if (!loan?.borrowerPhone) return;
    Linking.openURL(`tel:${loan.borrowerPhone}`).catch(() =>
      Alert.alert('Error', 'Could not open phone dialer')
    );
  }

  function handleWhatsApp() {
    if (!loan?.borrowerPhone) return;
    const digits = loan.borrowerPhone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${digits}`).catch(() =>
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to use this feature')
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{loan.borrowerName}</Text>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => router.push(`/(app)/borrowers/${loan.id}/edit`)} style={s.headerBtn}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPDF} style={s.headerBtn}>
            {exportLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteLoan} style={s.headerBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
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
            {loan.status === 'closed' && (
              <Text style={[s.metaText, { color: colors.danger, fontWeight: '700' }]}>
                CLOSED{loan.closedAt ? ` — ${format(new Date(loan.closedAt), 'dd MMM yyyy')}` : ''}
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

          {/* Contact buttons */}
          {loan.borrowerPhone && (
            <View style={s.contactRow}>
              <TouchableOpacity style={[s.contactBtn, { backgroundColor: colors.success + '22', borderColor: colors.success }]} onPress={handleCall}>
                <Ionicons name="call-outline" size={16} color={colors.success} />
                <Text style={[s.contactBtnText, { color: colors.success }]}>{t('borrowers.callBorrower')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.contactBtn, { backgroundColor: '#25D36622', borderColor: '#25D366' }]} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={[s.contactBtnText, { color: '#25D366' }]}>{t('borrowers.whatsapp')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          <View style={s.actionRow}>
            {loan.status === 'active' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push(`/(app)/borrowers/${loan.id}/repay`)}
              >
                <Ionicons name="arrow-down-circle-outline" size={16} color="#fff" />
                <Text style={s.actionBtnText}>{t('borrowers.repayPrincipal')}</Text>
              </TouchableOpacity>
            )}
            {loan.status === 'active' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.danger + '22', borderWidth: 1, borderColor: colors.danger }]}
                onPress={handleCloseLoan}
              >
                <Ionicons name="lock-closed-outline" size={16} color={colors.danger} />
                <Text style={[s.actionBtnText, { color: colors.danger }]}>{t('borrowers.close')}</Text>
              </TouchableOpacity>
            )}
            {loan.status === 'closed' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success }]}
                onPress={handleReopenLoan}
              >
                <Ionicons name="lock-open-outline" size={16} color={colors.success} />
                <Text style={[s.actionBtnText, { color: colors.success }]}>{t('borrowers.reopen')}</Text>
              </TouchableOpacity>
            )}
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

        {/* Monthly Interest Timeline */}
        <Text style={s.timelineTitle}>{t('payment.legend')} — Interest</Text>

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
                {!isPaid && !isDeferred && (
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

        {/* Principal Repayments Section */}
        {principalPayments.length > 0 && (
          <>
            <Text style={[s.timelineTitle, { marginTop: 20 }]}>{t('payment.principalHistory')}</Text>
            {principalPayments.map((p) => (
              <View key={p.id} style={[s.monthRow, { borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
                <View style={s.monthLeft}>
                  <Ionicons name="arrow-down-circle" size={20} color={colors.primary} style={{ marginTop: 2 }} />
                  <View>
                    <Text style={s.monthLabel}>
                      {p.type === 'principal_full' ? t('repayment.full').split(' (')[0] : t('repayment.partial')}
                    </Text>
                    <Text style={[s.monthAmount, { color: colors.primary }]}>
                      {formatCurrency(p.amount ?? 0)}
                    </Text>
                    <Text style={s.monthMeta}>
                      {format(new Date(p.createdAt), 'dd MMM yyyy')}
                      {p.notes ? ` — ${p.notes}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
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
    headerBtn: { width: 36, alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
    headerRight: { flexDirection: 'row', gap: 4 },
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
    contactRow: { flexDirection: 'row', gap: 10 },
    contactBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
      gap: 6,
      borderWidth: 1,
    },
    contactBtnText: { fontWeight: '700', fontSize: 13 },
    actionRow: { flexDirection: 'column', gap: 10 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 6,
    },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingVertical: 4,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    timelineTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
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

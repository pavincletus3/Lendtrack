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
  paidAmountFor,
} from '@/lib/calculations';
import { markInterestPaid, deletePayment } from '@/lib/firestore/payments';
import { closeLoan, reopenLoan as reopenLoanFn, deleteLoan, updateLoan } from '@/lib/firestore/loans';
import { generateBorrowerPDF } from '@/lib/pdf';
import { PaymentEntryModal } from '@/components/PaymentEntryModal';
import { CatchupPaymentModal } from '@/components/CatchupPaymentModal';
import { getUnpaidInterestMonths } from '@/lib/calculations';
import type { BadgeStatus, Payment } from '@/types';

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
  const [exportLoading, setExportLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState<string | null>(null);
  const [catchupOpen, setCatchupOpen] = useState(false);

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

  function openModalFor(month: string) {
    setModalMonth(month);
    setModalOpen(true);
  }

  const activeMonthPayment = modalMonth
    ? payments.find((p) => p.month === modalMonth && p.type === 'interest')
    : undefined;

  async function handleSavePayment(data: { paidAmount: number; paidAt: Date; notes?: string }) {
    if (!modalMonth) return;
    await markInterestPaid(
      {
        loanId: loan!.id,
        userId: user!.uid,
        month: modalMonth,
        expectedAmount: activeMonthPayment?.expectedAmount ?? monthly,
        paidAmount: data.paidAmount,
        paidAt: data.paidAt,
        notes: data.notes,
      },
      activeMonthPayment?.id
    );
  }

  async function handleDeletePayment() {
    if (!activeMonthPayment) return;
    await deletePayment(activeMonthPayment.id);
  }

  async function handleDeletePrincipalRepayment(p: Payment) {
    Alert.alert(
      t('payment.deletePrincipal'),
      t('payment.deletePrincipalConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayment(p.id);
              // Restore principal: full → re-open + add back, partial → just add back
              const restored = loan!.currentPrincipal + (p.amount ?? 0);
              await updateLoan(loan!.id, { currentPrincipal: restored });
              if (p.type === 'principal_full') {
                await reopenLoanFn(loan!.id);
              }
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleCloseLoan() {
    Alert.alert(t('borrowers.close'), t('borrowers.closeConfirm'), [
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
    ]);
  }

  async function handleReopenLoan() {
    Alert.alert(t('borrowers.reopen'), t('borrowers.reopenConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await reopenLoanFn(loan!.id);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function handleDeleteLoan() {
    Alert.alert('Delete Loan', `Permanently delete "${loan!.borrowerName}"? This cannot be undone.`, [
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
    ]);
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

  const modalMonthLabel = (() => {
    if (!modalMonth) return '';
    const [y, m] = modalMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(
      language === 'ta' ? 'ta-IN' : 'en-IN',
      { month: 'long', year: 'numeric' }
    );
  })();

  return (
    <View style={s.container}>
      <CatchupPaymentModal
        visible={catchupOpen}
        loan={loan}
        payments={payments}
        userId={user!.uid}
        language={language as 'en' | 'ta'}
        onClose={() => setCatchupOpen(false)}
      />
      <PaymentEntryModal
        visible={modalOpen}
        mode={activeMonthPayment?.status === 'paid' ? 'edit' : 'create'}
        monthLabel={modalMonthLabel}
        expectedAmount={activeMonthPayment?.expectedAmount ?? monthly}
        defaultAmount={activeMonthPayment ? paidAmountFor(activeMonthPayment) || undefined : undefined}
        defaultDate={activeMonthPayment?.paidAt}
        defaultNotes={activeMonthPayment?.notes}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePayment}
        onDelete={activeMonthPayment?.status === 'paid' ? handleDeletePayment : undefined}
      />

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
            {loan.status === 'active' && getUnpaidInterestMonths(loan, payments).length > 1 && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.warning }]}
                onPress={() => setCatchupOpen(true)}
              >
                <Ionicons name="wallet-outline" size={16} color="#fff" />
                <Text style={s.actionBtnText}>{t('payment.catchupPayment')}</Text>
              </TouchableOpacity>
            )}
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
          const status = getLoanMonthStatus(loan, month, payments, overdueAlertDays);
          const payment = payments.find(
            (p) => p.loanId === loan.id && p.month === month && p.type === 'interest'
          );
          const hasRecord = payment?.status === 'paid';
          const paid = paidAmountFor(payment);
          const expected = payment?.expectedAmount ?? monthly;

          const [year, mo] = month.split('-');
          const monthLabel = new Date(parseInt(year), parseInt(mo) - 1, 1)
            .toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', { month: 'long', year: 'numeric' });

          return (
            <TouchableOpacity
              key={month}
              style={s.monthRow}
              onPress={() => openModalFor(month)}
              activeOpacity={0.7}
            >
              <View style={s.monthLeft}>
                <View style={[s.monthDot, { backgroundColor: BADGE_COLORS[status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.monthLabel}>{monthLabel}</Text>
                  <Text style={[s.monthAmount, { color: colors.primary }]}>
                    {hasRecord ? formatCurrency(paid) : formatCurrency(expected)}
                    {hasRecord && status === 'partial' && (
                      <Text style={[s.monthMeta, { color: colors.warning }]}>
                        {' '}/ {formatCurrency(expected)}
                      </Text>
                    )}
                  </Text>
                  {hasRecord && payment?.paidAt && (
                    <Text style={s.monthMeta}>
                      {t('payment.paidOn')}: {format(new Date(payment.paidAt), 'dd MMM yyyy')}
                    </Text>
                  )}
                  {payment?.notes && (
                    <Text style={[s.monthMeta, { fontStyle: 'italic' }]}>{payment.notes}</Text>
                  )}
                </View>
              </View>

              <View style={s.monthActions}>
                {!hasRecord && (
                  <View style={[s.monthBtn, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={s.monthBtnText}>{t('payment.markPaid')}</Text>
                  </View>
                )}
                {hasRecord && (
                  <View style={[s.monthBadge, { backgroundColor: BADGE_COLORS[status] + '22' }]}>
                    <Ionicons
                      name={status === 'partial' ? 'time-outline' : 'checkmark-circle'}
                      size={16}
                      color={BADGE_COLORS[status]}
                    />
                    <Text style={[s.monthBadgeText, { color: BADGE_COLORS[status] }]}>
                      {t(`payment.${status}`)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
                  <View style={{ flex: 1 }}>
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
                <TouchableOpacity onPress={() => handleDeletePrincipalRepayment(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
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

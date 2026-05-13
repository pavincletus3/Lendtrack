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
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  getLoanMonths,
  monthlyInterest,
  paidAmountFor,
  getUnpaidInterestMonths,
} from '@/lib/calculations';
import { markInterestPaid, deletePayment } from '@/lib/firestore/payments';
import { closeLoan, reopenLoan as reopenLoanFn, deleteLoan, updateLoan } from '@/lib/firestore/loans';
import { generateBorrowerPDF } from '@/lib/pdf';
import { triggerHaptic } from '@/lib/haptics';
import { PaymentEntryModal } from '@/components/PaymentEntryModal';
import { CatchupPaymentModal } from '@/components/CatchupPaymentModal';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Card, PrimaryButton, AvatarCircle, ConfirmSheet, Skeleton, SkeletonRow } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BadgeStatus, Payment } from '@/types';

type PendingConfirm = 'close' | 'reopen' | 'delete' | null;

export default function BorrowerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const BADGE: Record<BadgeStatus, string> = {
    paid: colors.success,
    partial: colors.partial,
    pending: colors.warning,
    overdue: colors.danger,
  };
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const loans = useLoansStore((s) => s.loans);
  const allPayments = useLoansStore((s) => s.payments);
  const hiddenPaymentIds = useUiStore((s) => s.hiddenPaymentIds);
  const showUndoableAction = useUiStore((s) => s.showUndoableAction);
  const showMessage = useUiStore((s) => s.showMessage);
  const loan = loans.find((l) => l.id === id);
  const payments = useMemo(
    () => allPayments.filter((p) => p.loanId === id && !hiddenPaymentIds[p.id]),
    [allPayments, hiddenPaymentIds, id]
  );
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const language = useSettingsStore((s) => s.language);
  const [exportLoading, setExportLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState<string | null>(null);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const months = useMemo(() => loan ? getLoanMonths(loan) : [], [loan?.id, loan?.startDate?.toString()]);

  if (!loan) {
    return <BorrowerDetailSkeleton top={top} onBack={() => router.back()} />;
  }

  const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
  const unpaidCount = getUnpaidInterestMonths(loan, payments).length;
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

  function handleDeleteInterestPayment() {
    if (!activeMonthPayment) return;
    const p = activeMonthPayment;
    showUndoableAction({
      message: t('payment.unmarked'),
      actionLabel: t('common.undo'),
      hidePaymentIds: [p.id],
      onCommit: () => deletePayment(p.id),
    });
  }

  async function handleLongPressMonth(month: string) {
    if (loan!.status !== 'active') return;
    const status = getLoanMonthStatus(loan!, month, payments, overdueAlertDays);
    if (status === 'paid') return;
    triggerHaptic('medium');
    const existing = payments.find((p) => p.month === month && p.type === 'interest');
    try {
      await markInterestPaid(
        {
          loanId: loan!.id,
          userId: user!.uid,
          month,
          expectedAmount: existing?.expectedAmount ?? monthly,
          paidAmount: monthly,
          paidAt: new Date(),
        },
        existing?.id
      );
      showMessage(t('payment.markedPaid'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  function handleDeletePrincipalRepayment(p: Payment) {
    const restored = loan!.currentPrincipal + (p.amount ?? 0);
    const wasFullClose = p.type === 'principal_full';
    showUndoableAction({
      message: t('payment.principalDeleted'),
      actionLabel: t('common.undo'),
      hidePaymentIds: [p.id],
      onCommit: async () => {
        await deletePayment(p.id);
        await updateLoan(loan!.id, { currentPrincipal: restored });
        if (wasFullClose) await reopenLoanFn(loan!.id);
      },
    });
  }

  async function handleConfirmClose() {
    await closeLoan(loan!.id);
    router.back();
  }

  async function handleConfirmReopen() {
    await reopenLoanFn(loan!.id);
  }

  function handleConfirmDeleteLoan() {
    const loanId = loan!.id;
    const userId = user!.uid;
    const name = loan!.borrowerName;
    const loanPaymentIds = allPayments.filter((p) => p.loanId === loanId).map((p) => p.id);
    showUndoableAction({
      message: t('borrowers.deletedLoan', { name }),
      actionLabel: t('common.undo'),
      hideLoanIds: [loanId],
      hidePaymentIds: loanPaymentIds,
      onCommit: () => deleteLoan(loanId, userId),
    });
    router.dismissAll();
    router.replace('/(app)/(tabs)/borrowers');
  }

  async function handleExportPDF() {
    setExportLoading(true);
    try { await generateBorrowerPDF(loan!, payments, language as 'en' | 'ta'); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setExportLoading(false); }
  }

  function handleCall() {
    if (!loan?.borrowerPhone) return;
    Linking.openURL(`tel:${loan.borrowerPhone}`).catch(() => Alert.alert('Error', 'Could not open phone dialer'));
  }

  function handleWhatsApp() {
    if (!loan?.borrowerPhone) return;
    const digits = loan.borrowerPhone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${digits}`).catch(() => Alert.alert('WhatsApp not installed', 'Please install WhatsApp to use this feature'));
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
        onDelete={activeMonthPayment?.status === 'paid' ? handleDeleteInterestPayment : undefined}
      />

      <ConfirmSheet
        visible={pendingConfirm === 'close'}
        title={t('borrowers.close')}
        message={t('borrowers.closeLoanMessage')}
        confirmLabel={t('borrowers.close')}
        icon="lock-closed-outline"
        tone="danger"
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirmClose}
      />
      <ConfirmSheet
        visible={pendingConfirm === 'reopen'}
        title={t('borrowers.reopen')}
        message={t('borrowers.reopenLoanMessage')}
        confirmLabel={t('borrowers.reopen')}
        icon="lock-open-outline"
        tone="primary"
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirmReopen}
      />
      <ConfirmSheet
        visible={pendingConfirm === 'delete'}
        title={t('borrowers.deleteLoan')}
        message={t('borrowers.deleteLoanMessage', { name: loan.borrowerName })}
        confirmLabel={t('common.delete')}
        icon="trash-outline"
        tone="danger"
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirmDeleteLoan}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/(app)/loan/${loan.id}/edit`)} style={s.headerBtn}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPDF} disabled={exportLoading} style={s.headerBtn}>
            {exportLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="share-outline" size={22} color={colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPendingConfirm('delete')} style={s.headerBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140, gap: Spacing.lg }}>
        {/* Hero card */}
        <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md }}>
          <Card padding={24} radius={Radius.xxl}>
            <View style={s.heroTop}>
              <AvatarCircle name={loan.borrowerName} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={[Type.title, { color: colors.text }]} numberOfLines={1}>
                  {loan.borrowerName}
                </Text>
                {loan.borrowerPhone ? (
                  <Text style={[Type.caption, { color: colors.textMuted }]}>{loan.borrowerPhone}</Text>
                ) : null}
              </View>
              {loan.status === 'closed' && (
                <View style={[s.closedTag, { backgroundColor: colors.surface }]}>
                  <Text style={[Type.micro, { color: colors.textMuted }]}>CLOSED</Text>
                </View>
              )}
            </View>

            <Text style={[Type.caption, { color: colors.textMuted, marginTop: Spacing.xl }]}>
              {t('borrowers.currentPrincipal')}
            </Text>
            <Text style={[Type.heroXL, { color: colors.text, marginTop: 4 }]}>
              {formatCurrency(loan.currentPrincipal)}
            </Text>
            <Text style={[Type.caption, { color: colors.success, marginTop: 4 }]}>
              {formatCurrency(monthly)} / {t('common.perMonth').replace('/ ', '')} · {loan.interestRate}% {t('common.perMonth')}
            </Text>

            <View style={s.divider} />

            <View style={s.metaRow}>
              <MetaItem
                label={t('borrowers.startDate')}
                value={format(new Date(loan.startDate), 'dd MMM yyyy')}
                colors={colors}
              />
              <MetaItem
                label={t('borrowers.cycleType')}
                value={loan.cycleType === 'calendar' ? t('borrowers.calendar') : t('borrowers.anniversary')}
                colors={colors}
              />
              {loan.tenure ? (
                <MetaItem
                  label={t('borrowers.tenure')}
                  value={`${loan.tenure} ${t('borrowers.months')}`}
                  colors={colors}
                />
              ) : null}
            </View>

            {/* Contact buttons */}
            {loan.borrowerPhone && (
              <View style={s.contactRow}>
                <TouchableOpacity style={[s.contactBtn, { backgroundColor: colors.successTint }]} onPress={handleCall} activeOpacity={0.85}>
                  <Ionicons name="call-outline" size={16} color={colors.success} />
                  <Text style={[Type.pill, { color: colors.success }]}>{t('borrowers.callBorrower')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.contactBtn, { backgroundColor: '#25D36622' }]} onPress={handleWhatsApp} activeOpacity={0.85}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={[Type.pill, { color: '#25D366' }]}>{t('borrowers.whatsapp')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* Action buttons */}
        <View style={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}>
          {loan.status === 'active' && unpaidCount > 1 && (
            <PrimaryButton
              label={`${t('payment.catchupPayment')} (${unpaidCount} ${t('borrowers.months')})`}
              icon="wallet-outline"
              onPress={() => setCatchupOpen(true)}
              variant="secondary"
              fullWidth
            />
          )}
          {loan.status === 'active' && (
            <PrimaryButton
              label={t('borrowers.repayPrincipal')}
              icon="arrow-down-circle-outline"
              onPress={() => router.push(`/(app)/loan/${loan.id}/repay`)}
              fullWidth
            />
          )}
          {loan.status === 'active' && (
            <PrimaryButton
              label={t('borrowers.close')}
              icon="lock-closed-outline"
              onPress={() => setPendingConfirm('close')}
              variant="danger"
              fullWidth
            />
          )}
          {loan.status === 'closed' && (
            <PrimaryButton
              label={t('borrowers.reopen')}
              icon="lock-open-outline"
              onPress={() => setPendingConfirm('reopen')}
              variant="ghost"
              fullWidth
            />
          )}
        </View>

        {/* Legend */}
        <View style={s.legendRow}>
          {(['paid', 'partial', 'pending', 'overdue'] as BadgeStatus[]).map((key) => (
            <View key={key} style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: BADGE[key] }]} />
              <Text style={[Type.micro, { color: colors.textMuted }]}>{t(`payment.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Section: interest timeline */}
        <Text style={[Type.title, { color: colors.text, paddingHorizontal: Spacing.xl }]}>
          Interest history
        </Text>

        {months.length === 0 ? (
          <View style={s.empty}>
            <Text style={[Type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              No payment months yet. Interest begins from the month after the start date.
            </Text>
          </View>
        ) : (
          months.map((month, idx) => {
            const status = getLoanMonthStatus(loan, month, payments, overdueAlertDays);
            const payment = payments.find((p) => p.month === month && p.type === 'interest');
            const hasRecord = payment?.status === 'paid';
            const paid = paidAmountFor(payment);
            const expected = payment?.expectedAmount ?? monthly;

            const [year, mo] = month.split('-');
            const monthLabel = new Date(parseInt(year), parseInt(mo) - 1, 1)
              .toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', { month: 'long', year: 'numeric' });

            const sub = hasRecord
              ? status === 'partial'
                ? `${formatCurrency(paid)} / ${formatCurrency(expected)}${payment?.paidAt ? ` · ${format(new Date(payment.paidAt), 'dd MMM yyyy')}` : ''}`
                : `${formatCurrency(paid)}${payment?.paidAt ? ` · ${format(new Date(payment.paidAt), 'dd MMM yyyy')}` : ''}`
              : formatCurrency(expected);

            return (
              <View key={month}>
                <TouchableOpacity
                  style={s.timelineRow}
                  onPress={() => openModalFor(month)}
                  onLongPress={() => handleLongPressMonth(month)}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <View style={[s.timelineDot, { backgroundColor: BADGE[status] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.bodyBold, { color: colors.text }]}>{monthLabel}</Text>
                    <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>{sub}</Text>
                  </View>
                  <Text style={[Type.pill, { color: BADGE[status] }]}>
                    {t(`payment.${status}`).toUpperCase()}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                {idx < months.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 56 }} />
                )}
              </View>
            );
          })
        )}

        {/* Principal repayments */}
        {principalPayments.length > 0 && (
          <>
            <Text style={[Type.title, { color: colors.text, paddingHorizontal: Spacing.xl, marginTop: Spacing.lg }]}>
              {t('payment.principalHistory')}
            </Text>
            {principalPayments.map((p, idx) => (
              <View key={p.id}>
                <View style={s.principalRow}>
                  <View style={[s.principalIcon, { backgroundColor: colors.primaryTint }]}>
                    <Ionicons name="arrow-down" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.bodyBold, { color: colors.text }]}>
                      {p.type === 'principal_full' ? t('repayment.full').split(' (')[0] : t('repayment.partial')}
                    </Text>
                    <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {format(new Date(p.createdAt), 'dd MMM yyyy')}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </Text>
                  </View>
                  <Text style={[Type.bodyBold, { color: colors.primary }]}>
                    -{formatCurrency(p.amount ?? 0)}
                  </Text>
                  <TouchableOpacity onPress={() => handleDeletePrincipalRepayment(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                {idx < principalPayments.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} />
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MetaItem({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
        {label}
      </Text>
      <Text style={[Type.captionBold, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function BorrowerDetailSkeleton({ top, onBack }: { top: number; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: top + Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
      }}>
        <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width={38} height={38} radius={Radius.md} />)}
        </View>
      </View>
      <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md, gap: Spacing.lg }}>
        <Card padding={24} radius={Radius.xxl}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width={'60%'} height={18} />
              <Skeleton width={'40%'} height={12} />
            </View>
          </View>
          <Skeleton width={'40%'} height={12} style={{ marginTop: Spacing.xl }} />
          <Skeleton width={'70%'} height={36} style={{ marginTop: 8 }} radius={8} />
          <Skeleton width={'50%'} height={12} style={{ marginTop: 8 }} />
        </Card>
        <View>
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </View>
      </View>
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
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerActions: { flexDirection: 'row', gap: 4 },
    headerBtn: {
      padding: 8,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    closedTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.lg },
    metaRow: { flexDirection: 'row', gap: Spacing.md },
    contactRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    contactBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.pill,
    },
    legendRow: {
      flexDirection: 'row',
      gap: Spacing.lg,
      paddingHorizontal: Spacing.xl,
      flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    empty: { paddingHorizontal: Spacing.xl, paddingVertical: 20 },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    timelineDot: { width: 12, height: 12, borderRadius: 6 },
    principalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    principalIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

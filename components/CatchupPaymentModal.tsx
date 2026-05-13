import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getUnpaidInterestMonths,
  distributeCatchup,
} from '@/lib/calculations';
import { markInterestPaid } from '@/lib/firestore/payments';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { PrimaryButton } from '@/components/ui';
import type { Loan, Payment } from '@/types';

export interface CatchupPaymentModalProps {
  visible: boolean;
  loan: Loan;
  payments: Payment[];
  userId: string;
  language: 'en' | 'ta';
  onClose: () => void;
}

export function CatchupPaymentModal({
  visible,
  loan,
  payments,
  userId,
  language,
  onClose,
}: CatchupPaymentModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const unpaid = useMemo(() => getUnpaidInterestMonths(loan, payments), [loan, payments]);
  const totalOwed = unpaid.reduce((s, u) => s + u.owed, 0);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setPaidAt(new Date());
      setNotes('');
    }
  }, [visible]);

  const amountNum = parseFloat(amount) || 0;
  const { allocations, leftover } = useMemo(
    () => distributeCatchup(unpaid, amountNum),
    [unpaid, amountNum]
  );

  const fullCount = allocations.filter((a) => a.fullyPaid).length;
  const partialCount = allocations.filter((a) => !a.fullyPaid && a.applied > 0).length;
  const stillUnpaid = unpaid.length - allocations.length;

  function fmtMonth(month: string): string {
    const [y, m] = month.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(
      language === 'ta' ? 'ta-IN' : 'en-IN',
      { month: 'short', year: 'numeric' }
    );
  }

  function handleSave() {
    if (amountNum <= 0) {
      Alert.alert('Error', t('payment.amountRequired'));
      return;
    }
    if (amountNum > totalOwed) {
      Alert.alert(
        t('common.error'),
        t('payment.catchupExceeds', {
          amount: formatCurrency(amountNum),
          owed: formatCurrency(totalOwed),
        })
      );
      return;
    }
    const summary =
      `${t('payment.catchupSummaryFull', { count: fullCount })}` +
      (partialCount > 0
        ? `\n${t('payment.catchupSummaryPartial', {
            month: fmtMonth(allocations[allocations.length - 1].month),
            amount: formatCurrency(allocations[allocations.length - 1].applied),
          })}`
        : '') +
      (stillUnpaid > 0 ? `\n${t('payment.catchupSummaryRemaining', { count: stillUnpaid })}` : '');
    Alert.alert(t('payment.catchupConfirmTitle'), summary, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: applyAllocations },
    ]);
  }

  async function applyAllocations() {
    setBusy(true);
    try {
      await Promise.all(
        allocations.map((a) =>
          markInterestPaid(
            {
              loanId: loan.id,
              userId,
              month: a.month,
              expectedAmount: a.expected,
              paidAmount: a.newPaidAmount,
              paidAt,
              notes: notes.trim() || undefined,
            },
            a.paymentId
          )
        )
      );
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  const s = styles(colors);
  const nothingOwed = unpaid.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={[Type.titleLg, { color: colors.text }]}>{t('payment.catchupPayment')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {t('payment.catchupDesc')}
          </Text>

          {nothingOwed ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={[Type.bodyBold, { color: colors.text, marginTop: Spacing.sm }]}>
                {t('payment.catchupNothingOwed')}
              </Text>
            </View>
          ) : (
            <>
              <View style={[s.owedBox, { backgroundColor: colors.warningTint }]}>
                <View>
                  <Text style={[Type.micro, { color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                    {t('payment.totalOutstanding')}
                  </Text>
                  <Text style={[Type.hero, { color: colors.warning, marginTop: 2 }]}>
                    {formatCurrency(totalOwed)}
                  </Text>
                </View>
                <Text style={[Type.caption, { color: colors.warning, opacity: 0.8 }]}>
                  {t('payment.acrossMonths', { count: unpaid.length })}
                </Text>
              </View>

              <Text style={s.label}>{t('payment.amountReceived')} (₹)</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={String(totalOwed)}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={s.label}>{t('payment.dateOfPayment')}</Text>
              <TouchableOpacity style={[s.input, s.dateBtn]} onPress={() => setShowDate(true)}>
                <Text style={[Type.body, { color: colors.text }]}>{format(paidAt, 'dd MMM yyyy')}</Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {showDate && (
                <DateTimePicker
                  value={paidAt}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowDate(false);
                    if (date) setPaidAt(date);
                  }}
                />
              )}

              <Text style={s.label}>{t('repayment.notes')}</Text>
              <TextInput
                style={[s.input, { minHeight: 50 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={colors.textMuted}
              />

              {amountNum > 0 && (
                <View style={[s.preview, { backgroundColor: colors.surface }]}>
                  <Text style={[Type.micro, { color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                    {t('payment.catchupPreview')}
                  </Text>
                  <ScrollView style={{ maxHeight: 160, marginTop: Spacing.sm }}>
                    {allocations.map((a) => (
                      <View key={a.month} style={s.previewRow}>
                        <Text style={[Type.body, { color: colors.text }]}>{fmtMonth(a.month)}</Text>
                        <Text style={[Type.bodyBold, { color: a.fullyPaid ? colors.success : colors.warning }]}>
                          {formatCurrency(a.applied)}
                          {!a.fullyPaid && ` / ${formatCurrency(a.expected - a.previouslyPaid)}`}
                        </Text>
                      </View>
                    ))}
                    {stillUnpaid > 0 && (
                      <Text style={[Type.caption, { color: colors.textMuted, fontStyle: 'italic', marginTop: 4 }]}>
                        {t('payment.catchupSummaryRemaining', { count: stillUnpaid })}
                      </Text>
                    )}
                  </ScrollView>
                  {leftover > 0 && (
                    <Text style={[Type.caption, { color: colors.danger, marginTop: 4 }]}>
                      {t('payment.catchupLeftover', { amount: formatCurrency(leftover) })}
                    </Text>
                  )}
                </View>
              )}

              <View style={{ marginTop: Spacing.xl }}>
                <PrimaryButton
                  label={t('common.save')}
                  icon="checkmark"
                  onPress={handleSave}
                  loading={busy}
                  fullWidth
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
      maxHeight: '92%',
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: Spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    empty: { alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
    owedBox: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      marginTop: Spacing.lg,
    },
    label: { ...Type.micro, color: colors.textMuted, marginTop: Spacing.lg, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    preview: {
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      marginTop: Spacing.md,
    },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  });

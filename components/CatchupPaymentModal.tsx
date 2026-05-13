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
      (stillUnpaid > 0
        ? `\n${t('payment.catchupSummaryRemaining', { count: stillUnpaid })}`
        : '');

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}
      >
        <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>{t('payment.catchupPayment')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={s.sub}>{t('payment.catchupDesc')}</Text>

          {nothingOwed ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle" size={36} color={colors.success} />
              <Text style={[s.emptyText, { color: colors.text }]}>
                {t('payment.catchupNothingOwed')}
              </Text>
            </View>
          ) : (
            <>
              <View style={s.owedBox}>
                <Text style={[s.owedLabel, { color: colors.textMuted }]}>
                  {t('payment.totalOutstanding')}
                </Text>
                <Text style={[s.owedValue, { color: colors.warning }]}>
                  {formatCurrency(totalOwed)}
                </Text>
                <Text style={[s.owedSub, { color: colors.textMuted }]}>
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
                <Text style={{ color: colors.text }}>{format(paidAt, 'dd MMM yyyy')}</Text>
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
                <View style={s.preview}>
                  <Text style={[s.previewTitle, { color: colors.primary }]}>
                    {t('payment.catchupPreview')}
                  </Text>
                  <ScrollView style={{ maxHeight: 140 }}>
                    {allocations.map((a) => (
                      <View key={a.month} style={s.previewRow}>
                        <Text style={[s.previewMonth, { color: colors.text }]}>
                          {fmtMonth(a.month)}
                        </Text>
                        <Text style={[s.previewAmount, { color: a.fullyPaid ? colors.success : colors.warning }]}>
                          {formatCurrency(a.applied)}
                          {!a.fullyPaid && ` / ${formatCurrency(a.expected - a.previouslyPaid)}`}
                        </Text>
                      </View>
                    ))}
                    {stillUnpaid > 0 && (
                      <Text style={[s.previewRemaining, { color: colors.textMuted }]}>
                        {t('payment.catchupSummaryRemaining', { count: stillUnpaid })}
                      </Text>
                    )}
                  </ScrollView>
                  {leftover > 0 && (
                    <Text style={[s.previewRemaining, { color: colors.danger }]}>
                      {t('payment.catchupLeftover', { amount: formatCurrency(leftover) })}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.primary }, busy && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={busy}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 28,
      gap: 6,
      maxHeight: '90%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 6,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    sub: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    empty: { alignItems: 'center', padding: 24, gap: 12 },
    emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
    owedBox: {
      backgroundColor: colors.warning + '15',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      marginBottom: 4,
    },
    owedLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    owedValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
    owedSub: { fontSize: 11, marginTop: 2 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 6 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    preview: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
      gap: 4,
    },
    previewTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    previewMonth: { fontSize: 13 },
    previewAmount: { fontSize: 13, fontWeight: '700' },
    previewRemaining: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
      marginTop: 14,
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });

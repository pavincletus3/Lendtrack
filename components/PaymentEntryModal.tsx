import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/calculations';

export interface PaymentEntryModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  monthLabel: string;
  expectedAmount: number;
  defaultAmount?: number;
  defaultDate?: Date;
  defaultNotes?: string;
  onClose: () => void;
  onSave: (input: { paidAmount: number; paidAt: Date; notes?: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

export function PaymentEntryModal({
  visible,
  mode,
  monthLabel,
  expectedAmount,
  defaultAmount,
  defaultDate,
  defaultNotes,
  onClose,
  onSave,
  onDelete,
}: PaymentEntryModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount(String(defaultAmount ?? expectedAmount));
      setPaidAt(defaultDate ?? new Date());
      setNotes(defaultNotes ?? '');
    }
  }, [visible]);

  const amountNum = parseFloat(amount) || 0;
  const isPartial = amountNum > 0 && amountNum < expectedAmount;
  const s = styles(colors);

  async function handleSave() {
    if (amountNum <= 0) {
      Alert.alert('Error', t('payment.amountRequired'));
      return;
    }
    if (amountNum > expectedAmount * 2) {
      Alert.alert(
        t('common.confirm'),
        t('payment.amountLargeConfirm', { amount: formatCurrency(amountNum) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.confirm'), onPress: () => actuallySave() },
        ]
      );
      return;
    }
    actuallySave();
  }

  async function actuallySave() {
    setBusy(true);
    try {
      await onSave({ paidAmount: amountNum, paidAt, notes: notes.trim() || undefined });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    Alert.alert(
      t('payment.markUnpaid'),
      t('payment.markUnpaidConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await onDelete();
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

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
            <Text style={s.title}>
              {mode === 'edit' ? t('payment.editPayment') : t('payment.recordPayment')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={s.monthLabel}>{monthLabel}</Text>
          <Text style={s.expected}>
            {t('payment.expectedInterest')}: {formatCurrency(expectedAmount)}
          </Text>

          <Text style={s.label}>{t('payment.amountReceived')} (₹)</Text>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder={String(expectedAmount)}
            placeholderTextColor={colors.textMuted}
          />
          {isPartial && (
            <Text style={[s.hint, { color: colors.warning }]}>
              {t('payment.partialHint', { remaining: formatCurrency(expectedAmount - amountNum) })}
            </Text>
          )}

          <Text style={s.label}>{t('payment.dateOfPayment')}</Text>
          <TouchableOpacity style={[s.input, s.dateBtn]} onPress={() => setShowDate(true)}>
            <Text style={{ color: colors.text }}>
              {format(paidAt, 'dd MMM yyyy')}
            </Text>
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
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder=""
            placeholderTextColor={colors.textMuted}
          />

          <View style={s.actions}>
            {mode === 'edit' && onDelete && (
              <TouchableOpacity
                style={[s.btn, { backgroundColor: colors.danger + '22', borderWidth: 1, borderColor: colors.danger }]}
                onPress={handleDelete}
                disabled={busy}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[s.btnText, { color: colors.danger }]}>{t('payment.markUnpaid')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.primary, flex: 1 }, busy && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={busy}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={[s.btnText, { color: '#fff' }]}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
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
      gap: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    monthLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    expected: { fontSize: 13, color: colors.primary, fontWeight: '700', marginBottom: 6 },
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
    hint: { fontSize: 11, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 6,
    },
    btnText: { fontWeight: '700', fontSize: 13 },
  });

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
import { Type, Spacing, Radius } from '@/constants/Typography';
import { PrimaryButton } from '@/components/ui';

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
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={[Type.titleLg, { color: colors.text }]}>
              {mode === 'edit' ? t('payment.editPayment') : t('payment.recordPayment')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>{monthLabel}</Text>
          <Text style={[Type.captionBold, { color: colors.primary, marginTop: 2 }]}>
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
            <Text style={[Type.micro, { color: colors.warning, marginTop: 4 }]}>
              {t('payment.partialHint', { remaining: formatCurrency(expectedAmount - amountNum) })}
            </Text>
          )}

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
            style={[s.input, { minHeight: 56 }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder=""
            placeholderTextColor={colors.textMuted}
          />

          <View style={s.actions}>
            {mode === 'edit' && onDelete && (
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={t('payment.markUnpaid')}
                  icon="trash-outline"
                  onPress={handleDelete}
                  variant="danger"
                  fullWidth
                />
              </View>
            )}
            <View style={{ flex: mode === 'edit' && onDelete ? 1 : 2 }}>
              <PrimaryButton
                label={t('common.save')}
                icon="checkmark"
                onPress={handleSave}
                loading={busy}
                fullWidth
              />
            </View>
          </View>
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
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: Spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  });

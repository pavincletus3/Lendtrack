import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '@/store/loansStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/calculations';
import { recordPrincipalRepayment } from '@/lib/firestore/payments';
import { updateLoan, closeLoan } from '@/lib/firestore/loans';

export default function RepayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loans = useLoansStore((s) => s.loans);
  const loan = loans.find((l) => l.id === id);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loan) return null;

  const amountNum = parseFloat(amount) || 0;
  const isFullRepayment = amountNum >= loan.currentPrincipal;
  const remaining = Math.max(0, loan.currentPrincipal - amountNum);

  async function handleRecord() {
    if (amountNum <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (amountNum > loan!.currentPrincipal) {
      Alert.alert('Error', `Amount cannot exceed current principal of ${formatCurrency(loan!.currentPrincipal)}`);
      return;
    }

    const confirmMessage = isFullRepayment
      ? `Record full repayment of ${formatCurrency(amountNum)}? This will close the loan.`
      : `Record partial repayment of ${formatCurrency(amountNum)}? New principal will be ${formatCurrency(remaining)}.`;

    Alert.alert('Confirm Repayment', confirmMessage, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          setSaving(true);
          try {
            const type = isFullRepayment ? 'principal_full' : 'principal_partial';
            await recordPrincipalRepayment(loan!.id, user!.uid, amountNum, type, notes.trim() || undefined);

            if (isFullRepayment) {
              await closeLoan(loan!.id);
            } else {
              await updateLoan(loan!.id, { currentPrincipal: remaining });
            }
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('repayment.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        {/* Borrower summary */}
        <View style={s.infoCard}>
          <Text style={s.infoName}>{loan.borrowerName}</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('repayment.currentPrincipal')}</Text>
            <Text style={[s.infoValue, { color: colors.primary }]}>
              {formatCurrency(loan.currentPrincipal)}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('borrowers.originalPrincipal')}</Text>
            <Text style={s.infoValue}>{formatCurrency(loan.originalPrincipal)}</Text>
          </View>
        </View>

        {/* Amount input */}
        <Text style={s.label}>{t('repayment.amount')} (₹)</Text>
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Enter amount"
          placeholderTextColor={colors.textMuted}
        />

        {/* Preview */}
        {amountNum > 0 && (
          <View style={[s.previewCard, { backgroundColor: isFullRepayment ? colors.success + '15' : colors.primary + '15' }]}>
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>{t('repayment.type')}</Text>
              <Text style={[s.previewValue, { color: isFullRepayment ? colors.success : colors.primary }]}>
                {isFullRepayment ? t('repayment.full') : t('repayment.partial')}
              </Text>
            </View>
            {!isFullRepayment && (
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>{t('repayment.afterRepayment')}</Text>
                <Text style={[s.previewValue, { color: colors.primary }]}>
                  {formatCurrency(remaining)}
                </Text>
              </View>
            )}
            {isFullRepayment && (
              <Text style={[s.previewNote, { color: colors.success }]}>
                ✓ Loan will be marked as closed
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        <Text style={s.label}>{t('repayment.notes')}</Text>
        <TextInput
          style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Any notes..."
          placeholderTextColor={colors.textMuted}
        />

        <TouchableOpacity
          style={[s.recordBtn, { backgroundColor: isFullRepayment ? colors.success : colors.primary }, saving && { opacity: 0.6 }]}
          onPress={handleRecord}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={s.recordBtnText}>{t('repayment.record')}</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
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
    form: { padding: 20, paddingBottom: 40, gap: 12 },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      marginBottom: 8,
    },
    infoName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 13, color: colors.textMuted },
    infoValue: { fontSize: 15, fontWeight: '700', color: colors.text },
    label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
    },
    previewCard: {
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    previewLabel: { fontSize: 13, color: colors.textMuted },
    previewValue: { fontSize: 15, fontWeight: '700' },
    previewNote: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    recordBtn: {
      borderRadius: 14,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    recordBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
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
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Card, Field, Input, PrimaryButton, AvatarCircle } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RepayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const loans = useLoansStore((s) => s.loans);
  const loan = loans.find((l) => l.id === id);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loan) return null;

  const amountNum = parseFloat(amount) || 0;
  const isFullRepayment = amountNum >= loan.currentPrincipal && amountNum > 0;
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
            if (isFullRepayment) await closeLoan(loan!.id);
            else await updateLoan(loan!.id, { currentPrincipal: remaining });
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: top + Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[Type.titleLg, { color: colors.text }]}>{t('repayment.title')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Hero summary */}
        <Card padding={20} radius={Radius.xxl} style={{ marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <AvatarCircle name={loan.borrowerName} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[Type.title, { color: colors.text }]} numberOfLines={1}>
                {loan.borrowerName}
              </Text>
              <Text style={[Type.caption, { color: colors.textMuted }]}>
                Original: {formatCurrency(loan.originalPrincipal)}
              </Text>
            </View>
          </View>

          <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg }]}>
            {t('repayment.currentPrincipal')}
          </Text>
          <Text style={[Type.heroXL, { color: colors.primary, marginTop: 4 }]}>
            {formatCurrency(loan.currentPrincipal)}
          </Text>
        </Card>

        <Field label={`${t('repayment.amount')} (₹)`}>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
          />
        </Field>

        {amountNum > 0 && (
          <Card
            padding={16}
            radius={Radius.lg}
            style={{
              marginVertical: Spacing.sm,
              backgroundColor: isFullRepayment ? colors.successTint : colors.primaryTint,
            }}
            elevated={false}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[Type.caption, { color: colors.textMuted }]}>{t('repayment.type')}</Text>
              <Text style={[Type.bodyBold, { color: isFullRepayment ? colors.success : colors.primary }]}>
                {isFullRepayment ? t('repayment.full') : t('repayment.partial')}
              </Text>
            </View>
            {!isFullRepayment && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm }}>
                <Text style={[Type.caption, { color: colors.textMuted }]}>{t('repayment.afterRepayment')}</Text>
                <Text style={[Type.bodyBold, { color: colors.primary }]}>{formatCurrency(remaining)}</Text>
              </View>
            )}
            {isFullRepayment && (
              <Text style={[Type.caption, { color: colors.success, marginTop: Spacing.sm }]}>
                ✓ Loan will be marked as closed
              </Text>
            )}
          </Card>
        )}

        <Field label={t('repayment.notes')}>
          <Input
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Field>

        <View style={{ marginTop: Spacing.xl }}>
          <PrimaryButton
            label={t('repayment.record')}
            icon="checkmark-circle-outline"
            onPress={handleRecord}
            loading={saving}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </View>
  );
}

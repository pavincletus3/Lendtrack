import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLoansStore } from '@/store/loansStore';
import { useTheme } from '@/hooks/useTheme';
import { ContactPickerModal } from '@/components/ContactPickerModal';
import { updateLoan } from '@/lib/firestore/loans';
import { monthlyInterest, formatCurrency } from '@/lib/calculations';
import { normalizePhone } from '@/lib/phone';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Card, Field, Input, PressableField, Segmented, PrimaryButton } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const loans = useLoansStore((s) => s.loans);
  const loan = loans.find((l) => l.id === id);

  const [borrowerName, setBorrowerName] = useState(loan?.borrowerName ?? '');
  const [borrowerPhone, setBorrowerPhone] = useState(loan?.borrowerPhone ?? '');
  const [interestRate, setInterestRate] = useState(String(loan?.interestRate ?? '2'));
  const [cycleType, setCycleType] = useState<'calendar' | 'anniversary'>(loan?.cycleType ?? 'calendar');
  const [startDate, setStartDate] = useState(loan ? new Date(loan.startDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTenure, setHasTenure] = useState(!!loan?.tenure);
  const [tenure, setTenure] = useState(String(loan?.tenure ?? '12'));
  const [notes, setNotes] = useState(loan?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  if (!loan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const rateNum = parseFloat(interestRate) || 0;
  const monthly = monthlyInterest(loan.currentPrincipal, rateNum);

  async function handleSave() {
    if (!borrowerName.trim()) {
      Alert.alert('Error', 'Borrower name is required');
      return;
    }
    if (rateNum <= 0) {
      Alert.alert('Error', 'Enter a valid interest rate');
      return;
    }

    setSaving(true);
    try {
      const phone = normalizePhone(borrowerPhone);
      await updateLoan(loan!.id, {
        borrowerName: borrowerName.trim(),
        borrowerPhone: phone || undefined,
        interestRate: rateNum,
        cycleType,
        startDate,
        tenure: hasTenure ? parseInt(tenure) || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update loan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ContactPickerModal
        visible={contactPickerVisible}
        onClose={() => setContactPickerVisible(false)}
        onSelect={(_name, phone) => setBorrowerPhone(normalizePhone(phone))}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: top + Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[Type.titleLg, { color: colors.text }]}>{t('borrowers.editLoan')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Read-only principal info */}
        <Card padding={20} radius={Radius.xxl} style={{ marginBottom: Spacing.lg }}>
          <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            {t('borrowers.currentPrincipal')}
          </Text>
          <Text style={[Type.heroXL, { color: colors.text, marginTop: 4 }]}>
            {formatCurrency(loan.currentPrincipal)}
          </Text>
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>
            Original: {formatCurrency(loan.originalPrincipal)} · Use Repay Principal to change.
          </Text>
          {rateNum > 0 && (
            <Text style={[Type.captionBold, { color: colors.primary, marginTop: Spacing.sm }]}>
              {formatCurrency(monthly)} {t('common.perMonth')} at {rateNum}% ({rateNum * 12}% p.a.)
            </Text>
          )}
        </Card>

        <SectionLabel text="Borrower Details" colors={colors} />

        <Field label="Borrower Name">
          <Input
            value={borrowerName}
            onChangeText={setBorrowerName}
            autoCapitalize="words"
            placeholder="Full name"
          />
        </Field>

        <Field label={t('borrowers.phone')}>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                value={borrowerPhone}
                onChangeText={setBorrowerPhone}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
              />
            </View>
            <TouchableOpacity
              onPress={() => setContactPickerVisible(true)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: Radius.lg,
                paddingHorizontal: 16,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Field>

        <Field label={`${t('borrowers.interestRate')} (% ${t('common.perMonth')})`}>
          <Input value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" />
        </Field>

        <SectionLabel text="Loan Configuration" colors={colors} />

        <Field label={t('borrowers.startDate')}>
          <PressableField
            value={format(startDate, 'dd MMM yyyy')}
            onPress={() => setShowDatePicker(true)}
            icon="calendar-outline"
          />
        </Field>

        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}

        <Field label={t('borrowers.cycleType')}>
          <Segmented
            value={cycleType}
            onChange={(v) => setCycleType(v as 'calendar' | 'anniversary')}
            options={[
              { value: 'calendar', label: t('borrowers.calendar') },
              { value: 'anniversary', label: t('borrowers.anniversary') },
            ]}
          />
        </Field>

        <Card padding={16} radius={Radius.lg} style={{ marginVertical: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[Type.bodyBold, { color: colors.text }]}>
              {t('borrowers.tenure')} (optional)
            </Text>
            <Switch
              value={hasTenure}
              onValueChange={setHasTenure}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {hasTenure && (
          <Field label={`${t('borrowers.tenure')} (${t('borrowers.months')})`}>
            <Input value={tenure} onChangeText={setTenure} keyboardType="numeric" />
          </Field>
        )}

        <Field label={t('borrowers.notes')}>
          <Input
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Field>

        <View style={{ marginTop: Spacing.xl }}>
          <PrimaryButton
            label={t('common.save')}
            icon="checkmark-circle-outline"
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return (
    <Text style={[Type.micro, {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    }]}>
      {text}
    </Text>
  );
}

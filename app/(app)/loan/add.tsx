import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { ContactPickerModal } from '@/components/ContactPickerModal';
import { createLoan } from '@/lib/firestore/loans';
import { createHistoricalPaidPayments } from '@/lib/firestore/payments';
import { monthlyInterest, formatCurrency, getLoanMonths, currentMonthKey } from '@/lib/calculations';
import { normalizePhone } from '@/lib/phone';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Card, Field, Input, PressableField, Segmented, PrimaryButton } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddLoanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('2');
  const [cycleType, setCycleType] = useState<'calendar' | 'anniversary'>('calendar');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTenure, setHasTenure] = useState(false);
  const [tenure, setTenure] = useState('12');
  const [notes, setNotes] = useState('');
  const [backfillPaid, setBackfillPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(interestRate) || 0;
  const monthly = monthlyInterest(principalNum, rateNum);

  const pastMonthsToBackfill = (() => {
    const mockLoan = { id: '', startDate, cycleType } as any;
    return getLoanMonths(mockLoan).filter((m) => m < currentMonthKey());
  })();

  async function handleSave() {
    if (!borrowerName.trim()) {
      Alert.alert('Error', 'Borrower name is required');
      return;
    }
    if (principalNum <= 0) {
      Alert.alert('Error', 'Enter a valid principal amount');
      return;
    }
    if (rateNum <= 0) {
      Alert.alert('Error', 'Enter a valid interest rate');
      return;
    }

    setSaving(true);
    try {
      const phone = normalizePhone(borrowerPhone);
      const loanId = await createLoan({
        userId: user!.uid,
        borrowerName: borrowerName.trim(),
        borrowerPhone: phone || undefined,
        originalPrincipal: principalNum,
        currentPrincipal: principalNum,
        interestRate: rateNum,
        startDate,
        cycleType,
        tenure: hasTenure ? parseInt(tenure) : undefined,
        status: 'active',
        notes: notes.trim() || undefined,
      });
      if (backfillPaid && pastMonthsToBackfill.length > 0) {
        await createHistoricalPaidPayments(loanId, user!.uid, pastMonthsToBackfill, monthly);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save loan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ContactPickerModal
        visible={contactPickerVisible}
        onClose={() => setContactPickerVisible(false)}
        onSelect={(name, phone) => {
          setBorrowerName(name);
          setBorrowerPhone(normalizePhone(phone));
        }}
      />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: top + Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[Type.titleLg, { color: colors.text }]}>{t('borrowers.addLoan')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Preview card */}
        {principalNum > 0 && rateNum > 0 && (
          <Card padding={20} radius={Radius.xxl} style={{ marginBottom: Spacing.lg }}>
            <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Monthly Interest
            </Text>
            <Text style={[Type.heroXL, { color: colors.primary, marginTop: 4 }]}>
              {formatCurrency(monthly)}
            </Text>
            <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>
              {rateNum * 12}% per annum
            </Text>
          </Card>
        )}

        <SectionLabel text="Borrower Details" colors={colors} />

        <Field label={t('borrowers.principal') + ' (₹)'}>
          <Input
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="numeric"
            placeholder="100000"
          />
        </Field>

        <Field label={`${t('borrowers.interestRate')} (% ${t('common.perMonth')})`}>
          <Input
            value={interestRate}
            onChangeText={setInterestRate}
            keyboardType="numeric"
            placeholder="2"
          />
        </Field>

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

        {pastMonthsToBackfill.length > 0 && (
          <Card padding={16} radius={Radius.lg} style={{ marginVertical: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[Type.bodyBold, { color: colors.text }]}>Mark past months as paid</Text>
                <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  Auto-mark {pastMonthsToBackfill.length} past month{pastMonthsToBackfill.length > 1 ? 's' : ''} as paid
                </Text>
              </View>
              <Switch
                value={backfillPaid}
                onValueChange={setBackfillPaid}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </Card>
        )}

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
            <Input value={tenure} onChangeText={setTenure} keyboardType="numeric" placeholder="12" />
          </Field>
        )}

        <Field label={t('borrowers.notes')}>
          <Input
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
            placeholder=""
          />
        </Field>

        <View style={{ marginTop: Spacing.xl }}>
          <PrimaryButton
            label={t('borrowers.save')}
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

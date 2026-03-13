import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { createLoan } from '@/lib/firestore/loans';
import { monthlyInterest, formatCurrency } from '@/lib/calculations';

export default function AddLoanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
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
  const [compoundEnabled, setCompoundEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(interestRate) || 0;
  const monthly = monthlyInterest(principalNum, rateNum);

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
      await createLoan({
        userId: user!.uid,
        borrowerName: borrowerName.trim(),
        borrowerPhone: borrowerPhone.trim() || undefined,
        originalPrincipal: principalNum,
        currentPrincipal: principalNum,
        interestRate: rateNum,
        startDate,
        cycleType,
        tenure: hasTenure ? parseInt(tenure) : undefined,
        compoundEnabled,
        status: 'active',
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save loan');
    } finally {
      setSaving(false);
    }
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('borrowers.addLoan')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <SectionLabel text="Borrower Details" colors={colors} />

        <InputField label={t('borrowers.principal') + ' (₹)'} colors={colors}>
          <TextInput
            style={s.input}
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="numeric"
            placeholder="100000"
            placeholderTextColor={colors.textMuted}
          />
        </InputField>

        {principalNum > 0 && rateNum > 0 && (
          <View style={s.previewBox}>
            <Text style={[s.previewLabel, { color: colors.textMuted }]}>Monthly interest</Text>
            <Text style={[s.previewValue, { color: colors.primary }]}>{formatCurrency(monthly)}</Text>
            <Text style={[s.previewSub, { color: colors.textMuted }]}>{rateNum * 12}% per annum</Text>
          </View>
        )}

        <InputField label={`${t('borrowers.interestRate')} (% ${t('common.perMonth')})`} colors={colors}>
          <TextInput
            style={s.input}
            value={interestRate}
            onChangeText={setInterestRate}
            keyboardType="numeric"
            placeholder="2"
            placeholderTextColor={colors.textMuted}
          />
        </InputField>

        <InputField label={t('borrowers.principal').replace('Amount', 'Name') || 'Borrower Name'} colors={colors}>
          <TextInput
            style={s.input}
            value={borrowerName}
            onChangeText={setBorrowerName}
            autoCapitalize="words"
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
          />
        </InputField>

        <InputField label={t('borrowers.phone')} colors={colors}>
          <TextInput
            style={s.input}
            value={borrowerPhone}
            onChangeText={setBorrowerPhone}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            placeholderTextColor={colors.textMuted}
          />
        </InputField>

        <SectionLabel text="Loan Configuration" colors={colors} />

        {/* Start Date */}
        <InputField label={t('borrowers.startDate')} colors={colors}>
          <TouchableOpacity
            style={[s.input, s.dateButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: colors.text }}>
              {startDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </InputField>

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

        {/* Cycle Type */}
        <InputField label={t('borrowers.cycleType')} colors={colors}>
          <View style={s.segmented}>
            {(['calendar', 'anniversary'] as const).map((ct) => (
              <TouchableOpacity
                key={ct}
                style={[
                  s.segment,
                  cycleType === ct && { backgroundColor: colors.primary },
                ]}
                onPress={() => setCycleType(ct)}
              >
                <Text
                  style={[
                    s.segmentText,
                    { color: cycleType === ct ? '#fff' : colors.textMuted },
                  ]}
                >
                  {t(`borrowers.${ct}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputField>

        {/* Compound Toggle */}
        <View style={s.toggleRow}>
          <View>
            <Text style={s.toggleLabel}>{t('borrowers.compound')}</Text>
            <Text style={s.toggleSub}>
              {compoundEnabled ? t('payment.compoundNote') : t('payment.simpleNote')}
            </Text>
          </View>
          <Switch
            value={compoundEnabled}
            onValueChange={setCompoundEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Tenure Toggle */}
        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>{t('borrowers.tenure')} (optional)</Text>
          <Switch
            value={hasTenure}
            onValueChange={setHasTenure}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {hasTenure && (
          <InputField label={`${t('borrowers.tenure')} (${t('borrowers.months')})`} colors={colors}>
            <TextInput
              style={s.input}
              value={tenure}
              onChangeText={setTenure}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor={colors.textMuted}
            />
          </InputField>
        )}

        {/* Notes */}
        <InputField label={t('borrowers.notes')} colors={colors}>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Any additional notes..."
            placeholderTextColor={colors.textMuted}
          />
        </InputField>

        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={s.saveBtnText}>
            {saving ? t('common.loading') : t('borrowers.save')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return (
    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginTop: 16, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
      {text}
    </Text>
  );
}

function InputField({ label, colors, children }: { label: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>
        {label}
      </Text>
      {children}
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
    backBtn: { width: 40, alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    form: { padding: 20, paddingBottom: 40, gap: 8 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
    },
    previewBox: {
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginVertical: 4,
    },
    previewLabel: { fontSize: 12 },
    previewValue: { fontSize: 24, fontWeight: '800' },
    previewSub: { fontSize: 12, marginTop: 2 },
    dateButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    segmentText: { fontSize: 13, fontWeight: '600' },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
      gap: 12,
    },
    toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    toggleSub: { fontSize: 11, color: colors.textMuted, maxWidth: 240, marginTop: 2 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

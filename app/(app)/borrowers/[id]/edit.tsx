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
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLoansStore } from '@/store/loansStore';
import { useTheme } from '@/hooks/useTheme';
import { ContactPickerModal } from '@/components/ContactPickerModal';
import { updateLoan } from '@/lib/firestore/loans';
import { monthlyInterest, formatCurrency } from '@/lib/calculations';

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const loans = useLoansStore((s) => s.loans);
  const loan = loans.find((l) => l.id === id);

  // Prefill state from loan
  const [borrowerName, setBorrowerName] = useState(loan?.borrowerName ?? '');
  const [borrowerPhone, setBorrowerPhone] = useState(loan?.borrowerPhone ?? '');
  const [interestRate, setInterestRate] = useState(String(loan?.interestRate ?? '2'));
  const [cycleType, setCycleType] = useState<'calendar' | 'anniversary'>(loan?.cycleType ?? 'calendar');
  const [startDate, setStartDate] = useState(loan ? new Date(loan.startDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTenure, setHasTenure] = useState(!!loan?.tenure);
  const [tenure, setTenure] = useState(String(loan?.tenure ?? '12'));
  const [compoundEnabled, setCompoundEnabled] = useState(loan?.compoundEnabled ?? false);
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
      await updateLoan(loan.id, {
        borrowerName: borrowerName.trim(),
        borrowerPhone: borrowerPhone.trim() || undefined,
        interestRate: rateNum,
        cycleType,
        startDate,
        tenure: hasTenure ? parseInt(tenure) || undefined : undefined,
        compoundEnabled,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update loan');
    } finally {
      setSaving(false);
    }
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      <ContactPickerModal
        visible={contactPickerVisible}
        onClose={() => setContactPickerVisible(false)}
        onSelect={(_name, phone) => {
          setBorrowerPhone(phone);
        }}
      />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('borrowers.editLoan')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        {/* Read-only principal info */}
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>{t('borrowers.originalPrincipal')}</Text>
          <Text style={[s.infoValue, { color: colors.primary }]}>{formatCurrency(loan.originalPrincipal)}</Text>
          <Text style={s.infoSub}>{t('borrowers.currentPrincipal')}: {formatCurrency(loan.currentPrincipal)}</Text>
          <Text style={[s.infoSub, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
            Principal cannot be edited here. Use Repay Principal to change it.
          </Text>
        </View>

        <SectionLabel text="Borrower Details" colors={colors} />

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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={borrowerPhone}
              onChangeText={setBorrowerPhone}
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[s.input, { paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => setContactPickerVisible(true)}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </InputField>

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

        {rateNum > 0 && (
          <View style={s.previewBox}>
            <Text style={[s.previewLabel, { color: colors.textMuted }]}>Monthly interest at current principal</Text>
            <Text style={[s.previewValue, { color: colors.primary }]}>{formatCurrency(monthly)}</Text>
            <Text style={[s.previewSub, { color: colors.textMuted }]}>{rateNum * 12}% per annum</Text>
          </View>
        )}

        <SectionLabel text="Loan Configuration" colors={colors} />

        {/* Start Date */}
        <InputField label={t('borrowers.startDate')} colors={colors}>
          <TouchableOpacity
            style={[s.input, s.dateButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: colors.text }}>
              {startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                style={[s.segment, cycleType === ct && { backgroundColor: colors.primary }]}
                onPress={() => setCycleType(ct)}
              >
                <Text style={[s.segmentText, { color: cycleType === ct ? '#fff' : colors.textMuted }]}>
                  {t(`borrowers.${ct}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputField>

        {/* Compound Toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
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
            {saving ? t('common.loading') : t('common.save')}
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
    infoCard: {
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      padding: 14,
      marginBottom: 4,
    },
    infoLabel: { fontSize: 11, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
    infoSub: { fontSize: 12, color: colors.text, marginTop: 4 },
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
    segment: { flex: 1, paddingVertical: 12, alignItems: 'center' },
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

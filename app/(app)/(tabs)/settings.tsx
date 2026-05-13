import { useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { updateUserProfile } from '@/lib/firestore/users';
import { Type, Spacing, Radius } from '@/constants/Typography';
import {
  PageHeader,
  Card,
  AvatarCircle,
  SettingsRow,
  PickerSheet,
  Field,
  Input,
  PrimaryButton,
} from '@/components/ui';

type PickerKind = 'language' | 'theme' | 'overdue' | null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { logout, setProfile } = useAuthStore();
  const {
    language,
    theme,
    overdueAlertDays,
    vibrationEnabled,
    setLanguage,
    setTheme,
    setOverdueAlertDays,
    setVibrationEnabled,
  } = useSettingsStore();

  const [picker, setPicker] = useState<PickerKind>(null);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [draftName, setDraftName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  async function persistProfile(updates: Partial<{ displayName: string; language: 'en' | 'ta'; theme: 'light' | 'dark' | 'system'; overdueAlertDays: number }>) {
    try {
      await updateUserProfile(user!.uid, updates);
      if (profile) setProfile({ ...profile, ...updates });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleSaveName() {
    if (!draftName.trim()) return;
    setSaving(true);
    await persistProfile({ displayName: draftName.trim() });
    setSaving(false);
    setNameSheetOpen(false);
  }

  function handleSelectLanguage(v: 'en' | 'ta') {
    setLanguage(v);
    persistProfile({ language: v });
  }

  function handleSelectTheme(v: 'light' | 'dark' | 'system') {
    setTheme(v);
    persistProfile({ theme: v });
  }

  function handleSelectOverdue(v: number) {
    setOverdueAlertDays(v);
    persistProfile({ overdueAlertDays: v });
  }

  function handleLogout() {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: logout },
    ]);
  }

  const languageLabel = language === 'en' ? t('settings.english') : t('settings.tamil');
  const themeLabel = t(`settings.${theme}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader title={t('settings.title')} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile hero */}
        <View style={styles.profile}>
          <AvatarCircle name={profile?.displayName ?? 'U'} size={88} />
          <Text style={[Type.titleLg, { color: colors.text, marginTop: Spacing.md }]}>
            {profile?.displayName}
          </Text>
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {profile?.email}
          </Text>
          <TouchableOpacity
            onPress={() => { setDraftName(profile?.displayName ?? ''); setNameSheetOpen(true); }}
            style={[styles.editNameBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={14} color={colors.text} />
            <Text style={[Type.pill, { color: colors.text }]}>Edit name</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences (compact, mixed-tint icons) */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <Card padding={Spacing.md}>
          <SettingsRow
            compact
            icon="language-outline"
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            label={t('settings.language')}
            value={languageLabel}
            onPress={() => setPicker('language')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <SettingsRow
            compact
            icon={theme === 'dark' ? 'moon' : theme === 'light' ? 'sunny' : 'phone-portrait-outline'}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            label={t('settings.theme')}
            value={themeLabel}
            onPress={() => setPicker('theme')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <SettingsRow
            compact
            icon="alarm-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label={t('settings.overdueAlertDays')}
            value={`${overdueAlertDays} ${t('settings.days')}`}
            onPress={() => setPicker('overdue')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <SettingsRow
            compact
            icon="pulse-outline"
            iconBg={colors.primaryTint}
            iconColor={colors.primary}
            label={t('settings.vibration')}
            right={
              <Switch
                value={vibrationEnabled}
                onValueChange={setVibrationEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            }
          />
        </Card>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <Card padding={Spacing.sm}>
          <SettingsRow
            icon="log-out-outline"
            label={t('auth.logout')}
            onPress={handleLogout}
            destructive
          />
        </Card>

        <Text style={[Type.micro, { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl }]}>
          LendTrack v1.0.0
        </Text>
      </ScrollView>

      {/* Pickers */}
      <PickerSheet
        visible={picker === 'language'}
        title={t('settings.language')}
        value={language}
        options={[
          { value: 'en', label: t('settings.english') },
          { value: 'ta', label: t('settings.tamil') },
        ]}
        onSelect={(v) => handleSelectLanguage(v as 'en' | 'ta')}
        onClose={() => setPicker(null)}
      />

      <PickerSheet
        visible={picker === 'theme'}
        title={t('settings.theme')}
        value={theme}
        options={[
          { value: 'light', label: t('settings.light') },
          { value: 'dark', label: t('settings.dark') },
          { value: 'system', label: t('settings.system'), sublabel: 'Match phone setting' },
        ]}
        onSelect={(v) => handleSelectTheme(v as 'light' | 'dark' | 'system')}
        onClose={() => setPicker(null)}
      />

      <PickerSheet
        visible={picker === 'overdue'}
        title={t('settings.overdueAlertDays')}
        value={overdueAlertDays}
        options={[3, 5, 7, 10].map((d) => ({
          value: d,
          label: `${d} ${t('settings.days')}`,
          sublabel: t('settings.overdueAlertHelper', { count: d }),
        }))}
        onSelect={handleSelectOverdue}
        onClose={() => setPicker(null)}
      />

      {/* Edit name sheet */}
      <Modal visible={nameSheetOpen} transparent animationType="slide" onRequestClose={() => setNameSheetOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity style={styles.modalTouch} activeOpacity={1} onPress={() => setNameSheetOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[Type.titleLg, { color: colors.text, marginBottom: Spacing.lg }]}>
              {t('settings.displayName')}
            </Text>
            <Field label={t('settings.displayName')}>
              <Input
                value={draftName}
                onChangeText={setDraftName}
                autoCapitalize="words"
                autoFocus
              />
            </Field>
            <View style={{ marginTop: Spacing.md }}>
              <PrimaryButton
                label={t('common.save')}
                icon="checkmark"
                onPress={handleSaveName}
                loading={saving}
                fullWidth
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, paddingBottom: 140 },
  profile: { alignItems: 'center', paddingVertical: Spacing.xl },
  editNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  sectionLabel: {
    ...Type.micro,
    color: '#94A3B8',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    letterSpacing: 1,
  },
  sep: { height: 1, marginLeft: 44 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalSheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.lg,
  },
});

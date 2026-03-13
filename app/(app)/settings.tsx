import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { updateUserProfile } from '@/lib/firestore/users';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { logout, setProfile } = useAuthStore();
  const { language, theme, overdueAlertDays, setLanguage, setTheme, setOverdueAlertDays } =
    useSettingsStore();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile(user!.uid, { displayName: displayName.trim(), language, theme, overdueAlertDays });
      if (profile) {
        setProfile({ ...profile, displayName: displayName.trim(), language, theme, overdueAlertDays });
      }
      Alert.alert('', t('settings.saved'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: logout,
      },
    ]);
  }

  const s = styles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Account */}
      <Text style={s.sectionTitle}>{t('settings.account')}</Text>
      <View style={s.card}>
        <View style={s.profileRow}>
          <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[s.avatarText, { color: colors.primary }]}>
              {(profile?.displayName ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={s.profileName}>{profile?.displayName}</Text>
            <Text style={s.profileEmail}>{profile?.email}</Text>
          </View>
        </View>

        <Text style={s.label}>{t('settings.displayName')}</Text>
        <TextInput
          style={s.input}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Language */}
      <Text style={s.sectionTitle}>{t('settings.language')}</Text>
      <View style={s.card}>
        <View style={s.optionRow}>
          {(['en', 'ta'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                s.optionBtn,
                language === lang && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setLanguage(lang)}
            >
              <Text style={{ fontSize: 18 }}>{lang === 'en' ? '🇬🇧' : '🇮🇳'}</Text>
              <Text
                style={[s.optionText, { color: language === lang ? '#fff' : colors.text }]}
              >
                {lang === 'en' ? t('settings.english') : t('settings.tamil')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Theme */}
      <Text style={s.sectionTitle}>{t('settings.theme')}</Text>
      <View style={s.card}>
        <View style={s.optionRow}>
          {(['light', 'dark', 'system'] as const).map((th) => (
            <TouchableOpacity
              key={th}
              style={[
                s.optionBtn,
                { flex: 1 },
                theme === th && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTheme(th)}
            >
              <Text style={{ fontSize: 16 }}>
                {th === 'light' ? '☀️' : th === 'dark' ? '🌙' : '📱'}
              </Text>
              <Text
                style={[s.optionText, { color: theme === th ? '#fff' : colors.text }]}
              >
                {t(`settings.${th}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <Text style={s.sectionTitle}>{t('settings.notifications')}</Text>
      <View style={s.card}>
        <Text style={s.label}>{t('settings.overdueAlertDays')}</Text>
        <View style={s.stepsRow}>
          {[3, 5, 7, 10].map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                s.stepBtn,
                overdueAlertDays === day && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setOverdueAlertDays(day)}
            >
              <Text
                style={[s.stepText, { color: overdueAlertDays === day ? '#fff' : colors.text }]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.helperText}>
          Alert fires {overdueAlertDays} {t('settings.days')} after due date if interest not received
        </Text>
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[s.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Ionicons name="save-outline" size={18} color="#fff" />
        <Text style={s.saveBtnText}>
          {saving ? t('common.loading') : t('settings.save')}
        </Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={[s.logoutText, { color: colors.danger }]}>{t('auth.logout')}</Text>
      </TouchableOpacity>

      <Text style={[s.version, { color: colors.textMuted }]}>LendTrack v1.0.0</Text>
    </ScrollView>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48, gap: 8 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 16,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '800' },
    profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
    profileEmail: { fontSize: 13, color: colors.textMuted },
    label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    optionRow: { flexDirection: 'row', gap: 10 },
    optionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionText: { fontSize: 14, fontWeight: '600' },
    stepsRow: { flexDirection: 'row', gap: 10 },
    stepBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepText: { fontSize: 16, fontWeight: '700' },
    helperText: { fontSize: 12, color: colors.textMuted },
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
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.danger + '44',
    },
    logoutText: { fontSize: 15, fontWeight: '700' },
    version: { textAlign: 'center', fontSize: 12, marginTop: 8 },
  });

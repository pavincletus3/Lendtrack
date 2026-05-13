import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Field, Input, PrimaryButton } from '@/components/ui';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, resetPassword, loginWithGoogle, loading } = useAuthStore();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try { await login(email.trim(), password); }
    catch (e: any) { Alert.alert('Login Failed', e.message ?? 'Please check your credentials'); }
  }

  async function handleGoogle() {
    try { await loginWithGoogle(); }
    catch (e: any) { Alert.alert('Google Sign-In Failed', e.message ?? 'Please try again'); }
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetModalVisible(false);
      setResetEmail('');
      Alert.alert('', t('auth.resetEmailSent'));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[Type.heroXL, { color: colors.primary, letterSpacing: -2 }]}>lendtrack</Text>
          <Text style={[Type.titleLg, { color: colors.text, marginTop: Spacing.xl }]}>
            {t('auth.loginTitle')}
          </Text>
          <Text style={[Type.body, { color: colors.textMuted, marginTop: 4 }]}>
            {t('auth.loginSubtitle')}
          </Text>
        </View>

        <View>
          <Field label={t('auth.email')}>
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
            />
          </Field>

          <Field label={t('auth.password')}>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />
          </Field>

          <PrimaryButton
            label={t('auth.signIn')}
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
          />

          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm }}
            onPress={() => { setResetEmail(email); setResetModalVisible(true); }}
          >
            <Text style={[Type.captionBold, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            <Text style={[Type.micro, { color: colors.textMuted }]}>{t('auth.orContinueWith')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
          </View>

          <TouchableOpacity
            style={[styles.socialBtn, { backgroundColor: colors.surface }]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#EA4335' }}>G</Text>
            <Text style={[Type.bodyBold, { color: colors.text }]}>{t('auth.signInWithGoogle')}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[Type.body, { color: colors.textMuted }]}>{t('auth.noAccount')} </Text>
            <Link href="/(auth)/register">
              <Text style={[Type.bodyBold, { color: colors.primary }]}>{t('auth.signUp')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Reset password modal */}
      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={() => setResetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[Type.title, { color: colors.text }]}>{t('auth.resetPasswordTitle')}</Text>
            <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4, marginBottom: Spacing.lg }]}>
              {t('auth.resetPasswordDesc')}
            </Text>
            <Field label={t('auth.email')}>
              <Input
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
              />
            </Field>
            <PrimaryButton
              label={t('auth.sendResetLink')}
              onPress={handleResetPassword}
              loading={resetLoading}
              fullWidth
            />
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm }}
              onPress={() => setResetModalVisible(false)}
            >
              <Text style={[Type.captionBold, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xxl },
  header: { marginBottom: Spacing.xxl, alignItems: 'flex-start' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xl, gap: Spacing.md },
  dividerLine: { flex: 1, height: 1 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.xxl },
  modalCard: { borderRadius: Radius.xxl, padding: Spacing.xxl },
});

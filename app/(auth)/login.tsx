import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, resetPassword, loginWithGoogle, loginWithApple, loading } = useAuthStore();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Login Failed', e.message ?? 'Please check your credentials');
    }
  }

  async function handleGoogle() {
    try {
      await loginWithGoogle();
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e.message ?? 'Please try again');
    }
  }

  async function handleApple() {
    try {
      await loginWithApple();
    } catch (e: any) {
      if (e.code !== 'ERR_CANCELED') {
        Alert.alert('Apple Sign-In Failed', e.message ?? 'Please try again');
      }
    }
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

  const s = styles(colors, isDark);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={s.header}>
          <Text style={s.logo}>💰</Text>
          <Text style={s.appName}>{t('app.name')}</Text>
          <Text style={s.title}>{t('auth.loginTitle')}</Text>
          <Text style={s.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>{t('auth.email')}</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textMuted}
            placeholder="you@example.com"
          />

          <Text style={s.label}>{t('auth.password')}</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
            placeholder="••••••••"
          />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={s.buttonText}>
              {loading ? t('common.loading') : t('auth.signIn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.forgotBtn}
            onPress={() => { setResetEmail(email); setResetModalVisible(true); }}
          >
            <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('auth.orContinueWith')}</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={[s.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Text style={s.socialIcon}>G</Text>
            <Text style={[s.socialBtnText, { color: colors.text }]}>{t('auth.signInWithGoogle')}</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[s.socialBtn, { backgroundColor: isDark ? '#fff' : '#000', borderColor: isDark ? '#fff' : '#000' }]}
              onPress={handleApple}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={18} color={isDark ? '#000' : '#fff'} />
              <Text style={[s.socialBtnText, { color: isDark ? '#000' : '#fff' }]}>{t('auth.signInWithApple')}</Text>
            </TouchableOpacity>
          )}

          <View style={s.footer}>
            <Text style={s.footerText}>{t('auth.noAccount')} </Text>
            <Link href="/(auth)/register">
              <Text style={s.link}>{t('auth.signUp')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('auth.resetPasswordTitle')}</Text>
            <Text style={s.modalDesc}>{t('auth.resetPasswordDesc')}</Text>
            <TextInput
              style={s.input}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={colors.textMuted}
              placeholder="you@example.com"
            />
            <TouchableOpacity
              style={[s.button, resetLoading && s.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={resetLoading}
            >
              <Text style={s.buttonText}>
                {resetLoading ? t('common.loading') : t('auth.sendResetLink')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.forgotBtn}
              onPress={() => setResetModalVisible(false)}
            >
              <Text style={s.forgotText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 40 },
    logo: { fontSize: 56, marginBottom: 8 },
    appName: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: { fontSize: 14, color: colors.textMuted },
    form: { gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      gap: 10,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.textMuted },
    socialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      marginBottom: 8,
    },
    socialIcon: {
      fontSize: 16,
      fontWeight: '900',
      color: '#EA4335',
    },
    socialBtnText: { fontSize: 15, fontWeight: '600' },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    footerText: { color: colors.textMuted, fontSize: 14 },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    forgotBtn: { alignItems: 'center', paddingVertical: 12 },
    forgotText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      gap: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    modalDesc: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 8,
    },
  });

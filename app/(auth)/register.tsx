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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, loading } = useAuthStore();

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/(app)/dashboard');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message ?? 'Please try again');
    }
  }

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>💰</Text>
          <Text style={s.appName}>{t('app.name')}</Text>
          <Text style={s.title}>{t('auth.registerTitle')}</Text>
          <Text style={s.subtitle}>{t('auth.registerSubtitle')}</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>{t('auth.displayName')}</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholderTextColor={colors.textMuted}
            placeholder="Your full name"
          />

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
            placeholder="Minimum 6 characters"
          />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={s.buttonText}>
              {loading ? t('common.loading') : t('auth.signUp')}
            </Text>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>{t('auth.hasAccount')} </Text>
            <Link href="/(auth)/login">
              <Text style={s.link}>{t('auth.signIn')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: any) =>
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
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
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
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: colors.textMuted, fontSize: 14 },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  });

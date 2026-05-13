import { useState } from 'react';
import {
  View,
  Text,
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
import { Type, Spacing } from '@/constants/Typography';
import { Field, Input, PrimaryButton } from '@/components/ui';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      router.replace('/(app)/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message ?? 'Please try again');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[Type.heroXL, { color: colors.primary, letterSpacing: -2 }]}>lendtrack</Text>
          <Text style={[Type.titleLg, { color: colors.text, marginTop: Spacing.xl }]}>
            {t('auth.registerTitle')}
          </Text>
          <Text style={[Type.body, { color: colors.textMuted, marginTop: 4 }]}>
            {t('auth.registerSubtitle')}
          </Text>
        </View>

        <View>
          <Field label={t('auth.displayName')}>
            <Input
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your full name"
            />
          </Field>

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
              placeholder="Minimum 6 characters"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />
          </Field>

          <PrimaryButton
            label={t('auth.signUp')}
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
          />

          <View style={styles.footer}>
            <Text style={[Type.body, { color: colors.textMuted }]}>{t('auth.hasAccount')} </Text>
            <Link href="/(auth)/login">
              <Text style={[Type.bodyBold, { color: colors.primary }]}>{t('auth.signIn')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xxl },
  header: { marginBottom: Spacing.xxl, alignItems: 'flex-start' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
});

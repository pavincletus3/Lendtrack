import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '@/store/loansStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  currentMonthKey,
  monthlyInterest,
} from '@/lib/calculations';
import type { BadgeStatus } from '@/types';

const BADGE_CONFIG: Record<BadgeStatus, { bg: string; label: string }> = {
  paid: { bg: '#10B981', label: 'Paid' },
  pending: { bg: '#F59E0B', label: 'Pending' },
  deferred: { bg: '#60A5FA', label: 'Deferred' },
  overdue: { bg: '#EF4444', label: 'Overdue' },
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { loans, payments, stats, loading } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);

  const activeLoans = loans.filter((l) => l.status === 'active');
  const monthKey = currentMonthKey();
  const s = styles(colors, isDark);

  const remaining = Math.max(0, stats.expectedThisMonth - stats.collectedThisMonth);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} colors={[colors.primary]} />}
    >
      {/* Greeting */}
      <View style={s.greeting}>
        <Text style={s.greetName}>
          {t('app.name')} {profile?.displayName ? `| ${profile.displayName}` : ''}
        </Text>
        <Text style={s.greetMonth}>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
      </View>

      {/* Stats Grid */}
      <View style={s.statsGrid}>
        <StatCard
          label={t('dashboard.totalPrincipal')}
          sublabel={t('dashboard.inRotation')}
          value={formatCurrency(stats.totalPrincipalInRotation)}
          accent={colors.primary}
          icon="cash-outline"
          colors={colors}
        />
        <StatCard
          label={t('dashboard.interestReceived')}
          sublabel={t('dashboard.allTime')}
          value={formatCurrency(stats.totalInterestReceived)}
          accent={colors.success}
          icon="trending-up-outline"
          colors={colors}
        />
        <StatCard
          label={t('dashboard.totalAccrued')}
          sublabel={t('dashboard.includingDeferred')}
          value={formatCurrency(stats.totalInterestAccrued)}
          accent={colors.info}
          icon="stats-chart-outline"
          colors={colors}
        />
        <StatCard
          label={t('dashboard.expectedThisMonth')}
          sublabel={`${formatCurrency(stats.collectedThisMonth)} ${t('dashboard.collected')}`}
          value={formatCurrency(remaining)}
          accent={remaining > 0 ? colors.warning : colors.success}
          icon="wallet-outline"
          colors={colors}
        />
      </View>

      {/* Borrower List Header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>
          {t('dashboard.activeBorrowers')} ({activeLoans.length})
        </Text>
        <TouchableOpacity
          style={s.addButton}
          onPress={() => router.push('/(app)/borrowers/add')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addButtonText}>{t('dashboard.addLoan')}</Text>
        </TouchableOpacity>
      </View>

      {activeLoans.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>💸</Text>
          <Text style={s.emptyText}>{t('dashboard.noBorrowers')}</Text>
          <Text style={s.emptySubtext}>{t('dashboard.addFirstLoan')}</Text>
        </View>
      ) : (
        activeLoans.map((loan) => {
          const loanPayments = payments.filter((p) => p.loanId === loan.id);
          const status = getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays);
          const badge = BADGE_CONFIG[status];
          const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);

          return (
            <TouchableOpacity
              key={loan.id}
              style={s.borrowerCard}
              onPress={() => router.push(`/(app)/borrowers/${loan.id}`)}
            >
              <View style={s.borrowerInfo}>
                <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[s.avatarText, { color: colors.primary }]}>
                    {loan.borrowerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.borrowerMeta}>
                  <Text style={s.borrowerName}>{loan.borrowerName}</Text>
                  <Text style={s.borrowerPrincipal}>
                    {formatCurrency(loan.currentPrincipal)} principal
                  </Text>
                </View>
              </View>
              <View style={s.borrowerRight}>
                <Text style={[s.monthlyInterest, { color: colors.primary }]}>
                  {formatCurrency(monthly)}
                </Text>
                <Text style={s.perMonth}>{t('common.perMonth')}</Text>
                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                  <Text style={s.badgeText}>{badge.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  accent,
  icon,
  colors,
}: {
  label: string;
  sublabel: string;
  value: string;
  accent: string;
  icon: string;
  colors: any;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconBox, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon as any} size={20} color={accent} />
      </View>
      <Text style={[statStyles.value, { color: accent }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[statStyles.sublabel, { color: colors.textMuted }]}>{sublabel}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  sublabel: { fontSize: 11 },
});

const styles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 32, gap: 16 },
    greeting: { marginBottom: 4 },
    greetName: { fontSize: 22, fontWeight: '800', color: colors.text },
    greetMonth: { fontSize: 14, color: colors.textMuted },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 4,
    },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyIcon: { fontSize: 48 },
    emptyText: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySubtext: { fontSize: 13, color: colors.textMuted },
    borrowerCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
    },
    borrowerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800' },
    borrowerMeta: { flex: 1 },
    borrowerName: { fontSize: 15, fontWeight: '700', color: colors.text },
    borrowerPrincipal: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    borrowerRight: { alignItems: 'flex-end', gap: 4 },
    monthlyInterest: { fontSize: 17, fontWeight: '800' },
    perMonth: { fontSize: 11, color: colors.textMuted },
    badge: {
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 2,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  });

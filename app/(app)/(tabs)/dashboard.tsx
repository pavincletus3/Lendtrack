import { useState, useCallback } from 'react';
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
import { Type, Spacing, Radius } from '@/constants/Typography';
import { Card, PageHeader, StatHero, ListRow, PrimaryButton, AvatarCircle, Skeleton, SkeletonRow } from '@/components/ui';
import { triggerHaptic } from '@/lib/haptics';
import type { BadgeStatus } from '@/types';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { loans, payments, stats, loading } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const BADGE: Record<BadgeStatus, string> = {
    paid: colors.success,
    partial: colors.partial,
    pending: colors.warning,
    overdue: colors.danger,
  };

  const activeLoans = loans.filter((l) => l.status === 'active');
  const monthKey = currentMonthKey();
  const remaining = Math.max(0, stats.expectedThisMonth - stats.collectedThisMonth);

  const overdueLoans = activeLoans.filter((loan) => {
    const loanPayments = payments.filter((p) => p.loanId === loan.id);
    return getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays) === 'overdue';
  });

  const collectedDelta = stats.collectedThisMonth > 0
    ? `+${formatCurrency(stats.collectedThisMonth)} collected this month`
    : undefined;

  const onRefresh = useCallback(() => {
    triggerHaptic('medium');
    setRefreshing(true);
    // Firestore is realtime; this is mostly a tactile confirmation
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader
        title={t('dashboard.title')}
        right={
          <TouchableOpacity
            onPress={() => router.push('/(app)/(tabs)/settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AvatarCircle name={profile?.displayName ?? profile?.email ?? 'U'} size={36} />
          </TouchableOpacity>
        }
      />

      {loading && loans.length === 0 ? (
        <DashboardSkeleton />
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140, gap: Spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Overdue banner */}
        {overdueLoans.length > 0 && !bannerDismissed && (
          <View style={{ paddingHorizontal: Spacing.xl }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/(app)/(tabs)/monthly')}
              style={[styles.banner, { backgroundColor: colors.dangerTint }]}
            >
              <Ionicons name="warning" size={20} color={colors.danger} />
              <Text style={[Type.captionBold, { color: colors.danger, flex: 1 }]}>
                {overdueLoans.length} {t('dashboard.overdueAlert')}
              </Text>
              <TouchableOpacity
                onPress={() => setBannerDismissed(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={colors.danger} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero card */}
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <StatHero
            label={t('dashboard.totalPrincipal')}
            value={formatCurrency(stats.totalPrincipalInRotation)}
            delta={collectedDelta}
            deltaPositive
            caption={`${activeLoans.length} ${t('dashboard.activeBorrowers').toLowerCase()}`}
          />
        </View>

        {/* Add Loan button standalone */}
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <PrimaryButton
            label={t('dashboard.addLoan')}
            icon="add"
            onPress={() => router.push('/(app)/loan/add')}
            fullWidth
            size="lg"
          />
        </View>

        {/* 2x2 mini-stats grid */}
        <View style={[styles.grid, { paddingHorizontal: Spacing.xl }]}>
          <MiniStat
            label={t('dashboard.interestReceived')}
            value={formatCurrency(stats.totalInterestReceived)}
            sub={t('dashboard.allTime')}
            accent={colors.success}
          />
          <MiniStat
            label={t('dashboard.outstandingInterest')}
            value={formatCurrency(stats.totalOutstandingInterest)}
            sub={t('dashboard.outstandingSub')}
            accent={stats.totalOutstandingInterest > 0 ? colors.warning : colors.success}
          />
          <MiniStat
            label={t('dashboard.expectedThisMonth')}
            value={formatCurrency(remaining)}
            sub={`${formatCurrency(stats.collectedThisMonth)} ${t('dashboard.collected')}`}
            accent={remaining > 0 ? colors.warning : colors.success}
          />
          <MiniStat
            label={t('dashboard.activeBorrowers')}
            value={String(activeLoans.length)}
            sub={t('dashboard.inRotation')}
            accent={colors.primary}
          />
        </View>

        {/* Borrowers list */}
        <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md }}>
          <Text style={[Type.title, { color: colors.text }]}>
            {t('dashboard.activeBorrowers')}
          </Text>
        </View>

        {activeLoans.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>💸</Text>
            <Text style={[Type.title, { color: colors.text, marginTop: Spacing.md }]}>
              {t('dashboard.noBorrowers')}
            </Text>
            <Text style={[Type.body, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              {t('dashboard.addFirstLoan')}
            </Text>
            <View style={{ marginTop: Spacing.xl, alignSelf: 'stretch', paddingHorizontal: Spacing.xxxl }}>
              <PrimaryButton
                label={t('dashboard.addLoan')}
                icon="add"
                onPress={() => router.push('/(app)/loan/add')}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        ) : (
          <View>
            {activeLoans.map((loan) => {
              const loanPayments = payments.filter((p) => p.loanId === loan.id);
              const status = getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays);
              const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
              return (
                <ListRow
                  key={loan.id}
                  name={loan.borrowerName}
                  sublabel={`${formatCurrency(loan.currentPrincipal)} · ${loan.interestRate}% ${t('common.perMonth')}`}
                  amount={formatCurrency(monthly)}
                  amountSub={t(`payment.${status}`).toUpperCase()}
                  amountColor={BADGE[status]}
                  onPress={() => router.push(`/(app)/loan/${loan.id}`)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
      )}
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ flex: 1, paddingTop: Spacing.lg, gap: Spacing.lg }}>
      <View style={{ paddingHorizontal: Spacing.xl }}>
        <Card padding={20} radius={Radius.xxl}>
          <Skeleton width={'40%'} height={12} />
          <Skeleton width={'70%'} height={36} style={{ marginTop: 10 }} radius={8} />
          <Skeleton width={'50%'} height={12} style={{ marginTop: 10 }} />
        </Card>
      </View>
      <View style={{ paddingHorizontal: Spacing.xl }}>
        <Skeleton width={'100%'} height={52} radius={Radius.pill} />
      </View>
      <View style={[styles.grid, { paddingHorizontal: Spacing.xl }]}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} padding={16} radius={Radius.xl} style={{ width: '48%' }}>
            <Skeleton width={'60%'} height={10} />
            <Skeleton width={'80%'} height={20} style={{ marginTop: 8 }} />
            <Skeleton width={'50%'} height={10} style={{ marginTop: 8 }} />
          </Card>
        ))}
      </View>
      <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md }}>
        <Skeleton width={120} height={18} />
      </View>
      {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
    </View>
  );
}

function MiniStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  const { colors } = useTheme();
  return (
    <Card padding={16} radius={Radius.xl} style={{ width: '48%' }}>
      <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
        {label}
      </Text>
      <Text style={[Type.title, { color: accent, marginTop: 6 }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[Type.micro, { color: colors.textMuted, marginTop: 4 }]}>{sub}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
});

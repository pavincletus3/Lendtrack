import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '@/store/loansStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  currentMonthKey,
  monthlyInterest,
} from '@/lib/calculations';
import type { Loan, BadgeStatus } from '@/types';

const BADGE_CONFIG: Record<BadgeStatus, { bg: string }> = {
  paid: { bg: '#10B981' },
  pending: { bg: '#F59E0B' },
  deferred: { bg: '#60A5FA' },
  overdue: { bg: '#EF4444' },
};

export default function BorrowersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { loans, payments } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const monthKey = currentMonthKey();

  const filtered = loans.filter((l) => {
    const matchSearch = l.borrowerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = showClosed ? l.status === 'closed' : l.status === 'active';
    return matchSearch && matchStatus;
  });

  const s = styles(colors);

  function renderLoan({ item: loan }: { item: Loan }) {
    const loanPayments = payments.filter((p) => p.loanId === loan.id);
    const status = getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays);
    const badge = BADGE_CONFIG[status];
    const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/(app)/borrowers/${loan.id}`)}
      >
        <View style={[s.avatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[s.avatarText, { color: colors.primary }]}>
            {loan.borrowerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={s.meta}>
          <Text style={s.name}>{loan.borrowerName}</Text>
          <Text style={s.details}>
            {formatCurrency(loan.currentPrincipal)} · {loan.interestRate}% {t('common.perMonth')}
          </Text>
        </View>
        <View style={s.right}>
          <Text style={[s.monthly, { color: colors.primary }]}>{formatCurrency(monthly)}</Text>
          {loan.status === 'active' && (
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={s.badgeText}>{status.toUpperCase()}</Text>
            </View>
          )}
          {loan.status === 'closed' && (
            <View style={[s.badge, { backgroundColor: colors.textMuted }]}>
              <Text style={s.badgeText}>CLOSED</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('borrowers.search')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <TouchableOpacity
          style={[s.filterBtn, showClosed && { backgroundColor: colors.primary }]}
          onPress={() => setShowClosed(!showClosed)}
        >
          <Ionicons
            name={showClosed ? 'archive' : 'archive-outline'}
            size={18}
            color={showClosed ? '#fff' : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Tab indicator */}
      <View style={s.tabRow}>
        <TouchableOpacity onPress={() => setShowClosed(false)}>
          <Text style={[s.tab, !showClosed && { color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
            {t('borrowers.active')} ({loans.filter((l) => l.status === 'active').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowClosed(true)}>
          <Text style={[s.tab, showClosed && { color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
            {t('borrowers.closed')} ({loans.filter((l) => l.status === 'closed').length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderLoan}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>👥</Text>
            <Text style={s.emptyText}>{t('borrowers.noBorrowers')}</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(app)/borrowers/add')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchRow: {
      flexDirection: 'row',
      padding: 16,
      gap: 10,
      alignItems: 'center',
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },
    filterBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 8,
    },
    tab: { fontSize: 14, fontWeight: '600', color: colors.textMuted, paddingBottom: 8 },
    list: { padding: 16, gap: 12, paddingBottom: 100 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800' },
    meta: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    details: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    right: { alignItems: 'flex-end', gap: 4 },
    monthly: { fontSize: 16, fontWeight: '800' },
    badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyIcon: { fontSize: 40 },
    emptyText: { fontSize: 15, color: colors.textMuted },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
  });

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '@/store/loansStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  getLoanMonthStatus,
  currentMonthKey,
  monthlyInterest,
  paidAmountFor,
  findInterestPayment,
} from '@/lib/calculations';
import { triggerHaptic } from '@/lib/haptics';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { PageHeader, ListRow, PillChip, PrimaryButton, PickerSheet, SkeletonRow } from '@/components/ui';
import type { Loan, BadgeStatus, Payment } from '@/types';

type StatusFilter = 'all' | 'overdue' | 'pending' | 'paid';
type SortKey = 'overdue' | 'name' | 'principal' | 'startDate';

export default function BorrowersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { loans, payments, loading } = useLoansStore();
  const overdueAlertDays = useSettingsStore((s) => s.overdueAlertDays);
  const hiddenLoanIds = useUiStore((s) => s.hiddenLoanIds);
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('overdue');
  const [sortOpen, setSortOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const BADGE: Record<BadgeStatus, string> = {
    paid: colors.success,
    partial: colors.partial,
    pending: colors.warning,
    overdue: colors.danger,
  };

  const monthKey = currentMonthKey();

  const onRefresh = useCallback(() => {
    triggerHaptic('medium');
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  function loanOverdueAmount(loan: Loan, loanPayments: Payment[]): number {
    const p = findInterestPayment(loan.id, monthKey, loanPayments);
    const expected = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    const paid = paidAmountFor(p);
    return Math.max(0, expected - paid);
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const digitsNeedle = needle.replace(/[^0-9]/g, '');

    const base = loans.filter((l) => {
      if (hiddenLoanIds[l.id]) return false;
      const nameMatch = l.borrowerName.toLowerCase().includes(needle);
      const phoneDigits = (l.borrowerPhone ?? '').replace(/[^0-9]/g, '');
      const phoneMatch = digitsNeedle.length > 0 && phoneDigits.includes(digitsNeedle);
      const matchSearch = !needle || nameMatch || phoneMatch;
      const matchOpenClosed = showClosed ? l.status === 'closed' : l.status === 'active';
      if (!matchSearch || !matchOpenClosed) return false;
      if (showClosed || statusFilter === 'all') return true;
      const loanPayments = payments.filter((p) => p.loanId === l.id);
      const monthStatus = getLoanMonthStatus(l, monthKey, loanPayments, overdueAlertDays);
      if (statusFilter === 'paid') return monthStatus === 'paid' || monthStatus === 'partial';
      return monthStatus === statusFilter;
    });

    const compare: Record<SortKey, (a: Loan, b: Loan) => number> = {
      overdue: (a, b) => {
        const aPayments = payments.filter((p) => p.loanId === a.id);
        const bPayments = payments.filter((p) => p.loanId === b.id);
        return loanOverdueAmount(b, bPayments) - loanOverdueAmount(a, aPayments);
      },
      name: (a, b) => a.borrowerName.localeCompare(b.borrowerName),
      principal: (a, b) => b.currentPrincipal - a.currentPrincipal,
      startDate: (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    };

    return [...base].sort(compare[sortKey]);
  }, [loans, payments, search, showClosed, statusFilter, sortKey, hiddenLoanIds, monthKey, overdueAlertDays]);

  const visibleLoans = useMemo(() => loans.filter((l) => !hiddenLoanIds[l.id]), [loans, hiddenLoanIds]);
  const activeCount = visibleLoans.filter((l) => l.status === 'active').length;
  const closedCount = visibleLoans.filter((l) => l.status === 'closed').length;

  const FILTERS: Array<{ key: StatusFilter; labelKey: string }> = [
    { key: 'all', labelKey: 'borrowers.filterAll' },
    { key: 'overdue', labelKey: 'borrowers.filterOverdue' },
    { key: 'pending', labelKey: 'borrowers.filterPending' },
    { key: 'paid', labelKey: 'borrowers.filterPaid' },
  ];

  const SORT_OPTIONS: Array<{ value: SortKey; labelKey: string }> = [
    { value: 'overdue', labelKey: 'borrowers.sortOverdue' },
    { value: 'name', labelKey: 'borrowers.sortName' },
    { value: 'principal', labelKey: 'borrowers.sortPrincipal' },
    { value: 'startDate', labelKey: 'borrowers.sortStartDate' },
  ];

  const s = styles(colors);

  function renderLoan({ item: loan }: { item: Loan }) {
    const loanPayments = payments.filter((p) => p.loanId === loan.id);
    const status = getLoanMonthStatus(loan, monthKey, loanPayments, overdueAlertDays);
    const monthly = monthlyInterest(loan.currentPrincipal, loan.interestRate);
    return (
      <ListRow
        name={loan.borrowerName}
        sublabel={`${formatCurrency(loan.currentPrincipal)} · ${loan.interestRate}% ${t('common.perMonth')}`}
        amount={formatCurrency(monthly)}
        amountSub={loan.status === 'active' ? t(`payment.${status}`).toUpperCase() : 'CLOSED'}
        amountColor={loan.status === 'active' ? BADGE[status] : colors.textMuted}
        onPress={() => router.push(`/(app)/loan/${loan.id}`)}
        showChevron
      />
    );
  }

  function EmptyView() {
    const hasNoLoansAtAll = visibleLoans.length === 0;
    const hasSearch = search.trim().length > 0;
    const filtered = !showClosed && statusFilter !== 'all';

    let emoji = '👥';
    let title = t('borrowers.noBorrowers');
    let hint = t('dashboard.addFirstLoan');
    let showAddButton = true;

    if (hasSearch) {
      emoji = '🔍';
      title = t('borrowers.noResults');
      hint = t('borrowers.noResultsHint');
      showAddButton = false;
    } else if (showClosed) {
      emoji = '📁';
      title = t('borrowers.noClosed');
      hint = t('borrowers.noClosedHint');
      showAddButton = false;
    } else if (filtered) {
      emoji = '✨';
      title = t('borrowers.noInFilter');
      hint = t('borrowers.noInFilterHint');
      showAddButton = false;
    } else if (!hasNoLoansAtAll) {
      // Active tab, no filter, no search — but list is empty (everything hidden/closed)
      emoji = '✨';
      title = t('borrowers.noInFilter');
      hint = t('borrowers.noInFilterHint');
      showAddButton = false;
    }

    return (
      <View style={s.empty}>
        <Text style={{ fontSize: 56 }}>{emoji}</Text>
        <Text style={[Type.title, { color: colors.text, marginTop: Spacing.md }]}>
          {title}
        </Text>
        <Text style={[Type.body, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
          {hint}
        </Text>
        {showAddButton && (
          <View style={{ marginTop: Spacing.xl, alignSelf: 'stretch', paddingHorizontal: Spacing.xxxl }}>
            <PrimaryButton
              label={t('dashboard.addLoan')}
              icon="add"
              onPress={() => router.push('/(app)/loan/add')}
              fullWidth
              size="lg"
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <PageHeader title={t('borrowers.title')} />

      <PickerSheet
        visible={sortOpen}
        title={t('borrowers.sortBy')}
        value={sortKey}
        options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        onSelect={(v) => setSortKey(v as SortKey)}
        onClose={() => setSortOpen(false)}
      />

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
          onPress={() => setSortOpen(true)}
          activeOpacity={0.7}
          style={[s.sortBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="swap-vertical" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Active / Closed tabs */}
      <View style={s.segmentRow}>
        <PillChip
          label={`${t('borrowers.active')} ${activeCount}`}
          active={!showClosed}
          onPress={() => setShowClosed(false)}
          tone="primary"
        />
        <PillChip
          label={`${t('borrowers.closed')} ${closedCount}`}
          active={showClosed}
          onPress={() => setShowClosed(true)}
          tone="primary"
        />
      </View>

      {/* Status filter chips (active tab only) */}
      {!showClosed && (
        <View style={s.chipRow}>
          {FILTERS.map((f) => (
            <PillChip
              key={f.key}
              label={t(f.labelKey)}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
            />
          ))}
        </View>
      )}

      {loading && loans.length === 0 ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderLoan}
          contentContainerStyle={{ paddingBottom: 140, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 80 }} />}
          ListEmptyComponent={<EmptyView />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(app)/loan/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      gap: Spacing.sm,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
    sortBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
    chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md, flexWrap: 'wrap' },
    empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: Spacing.xl },
    fab: {
      position: 'absolute',
      bottom: 110,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
  });

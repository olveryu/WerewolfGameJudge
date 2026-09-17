/**
 * UsersTab — Admin user list
 *
 * Search + Sort AdminPills + Country/Type filter chips + Pagination FlatList.
 */

import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import type { AdminUser } from '@/features/admin/model/adminContracts';
import { fetchUsers } from '@/features/admin/services/adminApi';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';

import { AdminEmptyState, AdminPill, Pagination } from '../components';

const SORT_OPTIONS = [
  { key: 'created_at', label: '注册时间' },
  { key: 'level', label: '等级' },
  { key: 'games_played', label: '局数' },
  { key: 'updated_at', label: '最近活跃' },
] as const;

const COUNTRY_OPTIONS = ['全部', 'CN', 'US'] as const;
const TYPE_OPTIONS = [
  { key: undefined, label: '全部' },
  { key: 'registered', label: '已注册' },
  { key: 'anonymous', label: '匿名' },
] as const;

export const UsersTab: React.FC = () => {
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [type, setType] = useState<string | undefined>(undefined);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const params = { page, sort, order, country, type, search: debouncedSearch || undefined };
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminUsers', params],
    queryFn: ({ signal }) => fetchUsers(params, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const handleSortPress = useCallback(
    (key: string) => {
      if (sort === key) {
        setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
      } else {
        setSort(key);
        setOrder('desc');
      }
      setPage(1);
    },
    [sort],
  );

  const handleCountryPress = useCallback((c: string) => {
    setCountry(c === '全部' ? undefined : c);
    setPage(1);
  }, []);

  const handleTypePress = useCallback((t: string | undefined) => {
    setType(t);
    setPage(1);
  }, []);

  const renderUser = useCallback(
    ({ item }: { item: AdminUser }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{item.displayName ?? '匿名用户'}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{item.level}</Text>
          </View>
        </View>
        <Text style={styles.cardDetail}>
          {item.xp} XP · {item.gamesPlayed} 局
        </Text>
        <Text style={styles.cardMeta}>
          {item.lastCountry ?? '?'} · {item.lastColo ?? '?'} · {item.createdAt.slice(0, 10)}
        </Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {data !== undefined && !isError && <Text style={styles.summary}>总用户: {data.total}</Text>}

      <TextInput
        style={styles.searchInput}
        placeholder="搜索昵称或邮箱..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {/* Sort pills */}
      <View style={styles.pillRow}>
        {SORT_OPTIONS.map((opt) => (
          <AdminPill
            key={opt.key}
            label={`${opt.label}${sort === opt.key ? (order === 'desc' ? ' ↓' : ' ↑') : ''}`}
            isActive={sort === opt.key}
            onPress={() => handleSortPress(opt.key)}
          />
        ))}
      </View>

      {/* Filter chips */}
      <View style={styles.pillRow}>
        {COUNTRY_OPTIONS.map((c) => (
          <AdminPill
            key={c}
            label={c}
            isActive={c === '全部' ? !country : country === c}
            onPress={() => handleCountryPress(c)}
          />
        ))}
        <View style={styles.divider} />
        {TYPE_OPTIONS.map((opt) => (
          <AdminPill
            key={opt.label}
            label={opt.label}
            isActive={type === opt.key}
            onPress={() => handleTypePress(opt.key)}
          />
        ))}
      </View>

      {isError ? (
        <View>
          <AdminEmptyState loading={false} error="读取用户失败，请重试" empty={false} />
          <Button loading={isFetching} onPress={() => void refetch()}>
            重新读取
          </Button>
        </View>
      ) : data === undefined ? (
        <AdminEmptyState loading={isPending} error={null} empty={false} />
      ) : (
        <FlatList
          data={data.users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<AdminEmptyState loading={false} error={null} empty />}
        />
      )}

      {data !== undefined && !isError && (
        <Pagination page={page} totalPages={Math.ceil(data.total / 50)} onPageChange={setPage} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.medium },
  summary: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
    marginTop: spacing.small,
  },
  searchInput: {
    height: 40,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.small,
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
    marginBottom: spacing.tight,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: spacing.tight,
  },
  list: { paddingBottom: spacing.medium },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    marginBottom: spacing.tight,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  levelBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.small,
  },
  levelBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  cardDetail: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
  cardMeta: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: spacing.micro,
  },
});

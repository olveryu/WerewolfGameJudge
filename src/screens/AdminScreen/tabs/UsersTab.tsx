/**
 * UsersTab — Admin 用户列表
 *
 * Search + Sort Pills + Country/Type toggle chips + 分页 FlatList。
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';

import { type AdminUser, fetchUsers } from '../adminApi';

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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUsers({
        page,
        sort,
        order,
        country,
        type,
        search: debouncedSearch || undefined,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, country, type, debouncedSearch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalPages = Math.ceil(total / 50);

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

  const styles = useMemo(() => createStyles(), []);

  const renderUser = useCallback(
    ({ item }: { item: AdminUser }) => (
      <View style={styles.card}>
        <Text style={styles.cardName}>{item.displayName ?? '匿名用户'}</Text>
        <Text style={styles.cardDetail}>
          Lv.{item.level} · {item.xp} XP · {item.gamesPlayed} 局
        </Text>
        <Text style={styles.cardMeta}>
          {item.lastCountry ?? '?'} · {item.lastColo ?? '?'} · {item.createdAt.slice(0, 10)}
        </Text>
      </View>
    ),
    [styles],
  );

  return (
    <View style={styles.container}>
      {/* Summary */}
      <Text style={styles.summary}>总用户: {total}</Text>

      {/* Search */}
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
          <PressableScale
            key={opt.key}
            style={[styles.pill, sort === opt.key && styles.pillActive]}
            onPress={() => handleSortPress(opt.key)}
          >
            <Text style={[styles.pillText, sort === opt.key && styles.pillTextActive]}>
              {opt.label}
              {sort === opt.key && (order === 'desc' ? ' ↓' : ' ↑')}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Filter chips */}
      <View style={styles.pillRow}>
        {COUNTRY_OPTIONS.map((c) => (
          <PressableScale
            key={c}
            style={[styles.pill, (c === '全部' ? !country : country === c) && styles.pillActive]}
            onPress={() => handleCountryPress(c)}
          >
            <Text
              style={[
                styles.pillText,
                (c === '全部' ? !country : country === c) && styles.pillTextActive,
              ]}
            >
              {c}
            </Text>
          </PressableScale>
        ))}
        <View style={styles.divider} />
        {TYPE_OPTIONS.map((opt) => (
          <PressableScale
            key={opt.label}
            style={[styles.pill, type === opt.key && styles.pillActive]}
            onPress={() => handleTypePress(opt.key)}
          >
            <Text style={[styles.pillText, type === opt.key && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Error */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>无数据</Text>}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <PressableScale
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <Text style={styles.pageBtnText}>←</Text>
          </PressableScale>
          <Text style={styles.pageInfo}>
            {page} / {totalPages}
          </Text>
          <PressableScale
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <Text style={styles.pageBtnText}>→</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
};

function createStyles() {
  return StyleSheet.create({
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
    pill: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
    },
    pillActive: { backgroundColor: colors.primary },
    pillText: { fontSize: typography.caption, color: colors.textSecondary },
    pillTextActive: { color: colors.textInverse },
    divider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border,
      marginHorizontal: spacing.tight,
    },
    error: { color: colors.error, fontSize: typography.caption, marginBottom: spacing.tight },
    loader: { marginTop: spacing.xlarge },
    list: { paddingBottom: spacing.medium },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      marginBottom: spacing.tight,
      ...shadows.sm,
    },
    cardName: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    cardDetail: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.micro,
    },
    cardMeta: { fontSize: typography.caption, color: colors.textMuted, marginTop: spacing.micro },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xlarge },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.medium,
      paddingVertical: spacing.small,
    },
    pageBtn: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.surface,
    },
    pageBtnDisabled: { opacity: 0.3 },
    pageBtnText: { fontSize: typography.body, color: colors.text },
    pageInfo: { fontSize: typography.caption, color: colors.textSecondary },
  });
}

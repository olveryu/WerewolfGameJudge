/**
 * UsersTab — Admin user list
 *
 * Search + Sort AdminPills + Country/Type filter chips + Pagination FlatList.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import { Button } from '@/components/Button';
import type { AdminUser } from '@/features/admin/model/adminContracts';
import {
  AdminApiError,
  fetchUsers,
  getAdminWhoAmI,
  setUserAdmin,
} from '@/features/admin/services/adminApi';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';
import { componentSizes } from '@/theme/tokens';
import { showAlert } from '@/utils/alert';

import { AdminEmptyState, AdminPill, Pagination } from '../components';
import { UserRewardsModal } from './UserRewardsModal';

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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [rewardUser, setRewardUser] = useState<AdminUser | null>(null);
  // Pending grant/revoke confirm: null = hidden.
  const [confirmAdmin, setConfirmAdmin] = useState<{ user: AdminUser; grant: boolean } | null>(
    null,
  );

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

  // Whether the current caller is a super admin (can grant/revoke admin rights).
  const { data: whoAmI } = useQuery({
    queryKey: ['adminWhoAmI'],
    queryFn: ({ signal }) => getAdminWhoAmI(signal),
    staleTime: 60_000,
    retry: false,
  });
  const isSuperAdmin = whoAmI?.isSuperAdmin === true;

  const setAdminMutation = useMutation({
    mutationFn: ({ user, grant }: { user: AdminUser; grant: boolean }) =>
      setUserAdmin(user.id, grant),
    onSuccess: (_result, { user, grant }) => {
      setConfirmAdmin(null);
      void queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      showAlert(
        grant ? '任命成功' : '移除成功',
        grant
          ? `${user.displayName ?? '该用户'} 已成为管理员`
          : `${user.displayName ?? '该用户'} 的管理员权限已移除`,
      );
    },
    onError: (error: unknown) => {
      setConfirmAdmin(null);
      const message =
        error instanceof AdminApiError
          ? `操作失败（${error.status}）：${error.reason}`
          : '操作失败，请重试';
      showAlert('管理员任免失败', message);
    },
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
    ({ item }: { item: AdminUser }) => {
      const isSelf = whoAmI?.userId === item.id;
      // Super admin only: grant for non-admin non-anonymous users, revoke for
      // other admins (never yourself — the server also enforces this).
      const showGrant = isSuperAdmin && !item.isAdmin && !item.isAnonymous;
      const showRevoke = isSuperAdmin && item.isAdmin && !isSelf;
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{item.displayName ?? '匿名用户'}</Text>
            <View style={styles.badgeRow}>
              {item.isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>管理员</Text>
                </View>
              )}
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Lv.{item.level}</Text>
              </View>
            </View>
          </View>
          <Text selectable style={styles.cardId}>
            ID: {item.id}
          </Text>
          <Text style={styles.cardDetail}>
            {item.xp} XP · {item.gamesPlayed} 局
          </Text>
          <Text style={styles.cardMeta}>
            {item.lastCountry ?? '?'} · {item.lastColo ?? '?'} · {item.createdAt.slice(0, 10)}
          </Text>
          <View style={styles.actionRow}>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setRewardUser(item)}
              accessibilityLabel={`给${item.displayName ?? '匿名用户'}发放奖励`}
              icon={
                <Ionicons
                  name="gift-outline"
                  size={componentSizes.icon.sm}
                  color={colors.primary}
                />
              }
            >
              发放奖励
            </Button>
            {showGrant && (
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setConfirmAdmin({ user: item, grant: true })}
                accessibilityLabel={`任命${item.displayName ?? '该用户'}为管理员`}
              >
                任命管理员
              </Button>
            )}
            {showRevoke && (
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setConfirmAdmin({ user: item, grant: false })}
                accessibilityLabel={`移除${item.displayName ?? '该用户'}的管理员权限`}
              >
                移除管理员
              </Button>
            )}
          </View>
        </View>
      );
    },
    [isSuperAdmin, whoAmI?.userId],
  );

  return (
    <View style={styles.container}>
      {rewardUser !== null && (
        <UserRewardsModal
          key={rewardUser.id}
          user={rewardUser}
          onClose={() => setRewardUser(null)}
        />
      )}
      <AlertModal
        visible={confirmAdmin !== null}
        title={confirmAdmin?.grant === true ? '任命管理员' : '移除管理员'}
        message={
          confirmAdmin === null
            ? ''
            : confirmAdmin.grant
              ? `确定任命「${confirmAdmin.user.displayName ?? confirmAdmin.user.id}」为管理员？任命后对方即可进入 Admin Portal。`
              : `确定移除「${confirmAdmin.user.displayName ?? confirmAdmin.user.id}」的管理员权限？`
        }
        buttons={[
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            style: confirmAdmin?.grant === true ? 'default' : 'destructive',
            onPress: () => {
              if (confirmAdmin !== null) setAdminMutation.mutate(confirmAdmin);
            },
          },
        ]}
        onClose={() => setConfirmAdmin(null)}
      />
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
  adminBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.small,
  },
  adminBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  cardId: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    marginTop: spacing.micro,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
    marginTop: spacing.tight,
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

/** Admin user list: search, sort, country / type filters, pagination, and reward grants. */
import './AdminTabs.css';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import type { AdminUser } from '@/features/admin/model/adminContracts';
import { fetchUsers } from '@/features/admin/services/adminApi';
import IconGiftOutline from '~icons/ion/gift-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { AdminPill } from '../components/AdminPill';
import { Pagination } from '../components/Pagination';
import { UserRewardsModal } from './UserRewardsModal';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

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

type UserSort = (typeof SORT_OPTIONS)[number]['key'];
type UserType = (typeof TYPE_OPTIONS)[number]['key'];

function UserCard({ user, onGrant }: { user: AdminUser; onGrant: (user: AdminUser) => void }) {
  const name = user.displayName ?? '匿名用户';
  return (
    <li className="admin-card">
      <div className="admin-card-header">
        <span className="admin-card-name">{name}</span>
        <span className="admin-level-badge">Lv.{user.level}</span>
      </div>
      <span className="admin-card-detail">
        {user.xp} XP · {user.gamesPlayed} 局
      </span>
      <span className="admin-card-meta">
        {user.lastCountry ?? '?'} · {user.lastColo ?? '?'} · {user.createdAt.slice(0, 10)}
      </span>
      <div className="admin-card-actions">
        <Button
          variant="secondary"
          size="sm"
          aria-label={`给${name}发放奖励`}
          onClick={() => onGrant(user)}
        >
          <span className="admin-button-content">
            <IconGiftOutline aria-hidden />
            发放奖励
          </span>
        </Button>
      </div>
    </li>
  );
}

/** Admin users tab; each filter change cancels the previous request through the query signal. */
export function UsersTab() {
  const [page, setPage] = useState(1);
  const [rewardUser, setRewardUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<UserSort>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [type, setType] = useState<UserType>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const params = {
    page,
    sort,
    order,
    country,
    type,
    search: debouncedSearch || undefined,
  };
  const users = useQuery({
    queryKey: ['adminUsers', params],
    queryFn: ({ signal }) => fetchUsers(params, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const handleSortPress = (key: UserSort) => {
    if (sort === key) {
      setOrder((previous) => (previous === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setOrder('desc');
    }
    setPage(1);
  };

  const data = users.data;

  return (
    <div className="admin-tab">
      {rewardUser !== null && (
        <UserRewardsModal
          key={rewardUser.id}
          user={rewardUser}
          onClose={() => setRewardUser(null)}
        />
      )}
      <input
        type="search"
        className="admin-search-input"
        placeholder="搜索昵称或邮箱..."
        aria-label="搜索昵称或邮箱"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="admin-pill-row">
        {SORT_OPTIONS.map((option) => (
          <AdminPill
            key={option.key}
            label={
              sort === option.key
                ? `${option.label}${order === 'desc' ? ' ↓' : ' ↑'}`
                : option.label
            }
            isActive={sort === option.key}
            onPress={() => handleSortPress(option.key)}
          />
        ))}
      </div>
      <div className="admin-pill-row">
        {COUNTRY_OPTIONS.map((option) => {
          const value = option === '全部' ? undefined : option;
          return (
            <AdminPill
              key={option}
              label={option}
              isActive={country === value}
              onPress={() => {
                setCountry(value);
                setPage(1);
              }}
            />
          );
        })}
        <span className="admin-filter-divider" aria-hidden />
        {TYPE_OPTIONS.map((option) => (
          <AdminPill
            key={option.label}
            label={option.label}
            isActive={type === option.key}
            onPress={() => {
              setType(option.key);
              setPage(1);
            }}
          />
        ))}
      </div>
      {data !== undefined && !users.isError && (
        <p className="admin-summary">总用户: {data.total}</p>
      )}
      {users.isError ? (
        <>
          <AdminEmptyState loading={false} error="读取用户失败，请重试" empty={false} />
          <Button
            variant="secondary"
            loading={users.isFetching}
            onClick={() => void users.refetch()}
          >
            重新读取
          </Button>
        </>
      ) : data === undefined ? (
        <AdminEmptyState loading={users.isPending} error={null} empty={false} />
      ) : data.users.length === 0 ? (
        <AdminEmptyState loading={false} error={null} empty />
      ) : (
        <ul className="admin-list">
          {data.users.map((user) => (
            <UserCard key={user.id} user={user} onGrant={setRewardUser} />
          ))}
        </ul>
      )}
      {data !== undefined && !users.isError && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

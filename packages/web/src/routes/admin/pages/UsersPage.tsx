/** Explicit-search directory with indexed cursor navigation and recipient-scoped rewards. */
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { AdminUser } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchUsers } from '@/features/admin/services/adminApi';

import { formatNumber } from '../components/Charts';
import { CountryFilter } from '../components/CountryFilter';
import {
  AsyncBoundary,
  CursorPager,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatusBadge,
  type TableColumn,
} from '../components/Primitives';
import { UserDetails } from './UserDetails';

/** Filter changes remount the cursor stack; history and refresh preserve the filter itself. */
export function UsersPage() {
  const [parameters, setParameters] = useSearchParams();
  return (
    <UserDirectory
      key={parameters.toString()}
      parameters={parameters}
      onChange={(next) => setParameters(next)}
    />
  );
}

function UserDirectory({
  parameters,
  onChange,
}: {
  parameters: URLSearchParams;
  onChange: (parameters: URLSearchParams) => void;
}) {
  const [search, setSearch] = useState(parameters.get('q') ?? '');
  const [cursors, setCursors] = useState<string[]>(['']);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const sort = parameters.get('sort') ?? 'created_at';
  const order = parameters.get('order') ?? 'desc';
  const filters = {
    sort,
    order,
    country: parameters.get('country') ?? '',
    type: parameters.get('type') ?? '',
    q: parameters.get('q') ?? '',
    cursor: cursors.at(-1) ?? '',
  };
  const query = useQuery(
    adminQueryOptions('users', filters, (signal) => fetchUsers(filters, signal)),
  );
  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    onChange(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    change('q', search.trim());
  }
  function sortable(key: string) {
    return {
      sort:
        sort === key
          ? order === 'asc'
            ? ('ascending' as const)
            : ('descending' as const)
          : ('none' as const),
      onSort: () => {
        const next = new URLSearchParams(parameters);
        next.set('sort', key);
        next.set('order', sort === key && order === 'desc' ? 'asc' : 'desc');
        onChange(next);
      },
    };
  }
  const columns = userColumns(sortable, setSelected);
  return (
    <>
      <PageHeading
        title="用户"
        description="搜索、查看资料与发放奖励。不执行全库计数。"
        query={query}
      />
      <div className="admin-content">
        <form className="admin-toolbar admin-directory-toolbar" onSubmit={submit}>
          <div className="admin-search">
            <input
              type="search"
              aria-label="搜索用户"
              placeholder="搜索昵称，或输入完整邮箱"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">搜索</button>
          </div>
          <div className="admin-directory-filters">
            <div className="admin-segmented" role="group" aria-label="用户类型">
              {[
                ['', '全部'],
                ['registered', '已注册'],
                ['anonymous', '匿名'],
              ].map(([value = '', label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filters.type === value}
                  onClick={() => change('type', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <CountryFilter
              value={filters.country}
              onChange={(country) => change('country', country)}
            />
          </div>
        </form>
        <Panel flush>
          <AsyncBoundary query={query}>
            {(data) => (
              <>
                <DataTable
                  caption="用户目录"
                  columns={columns}
                  rows={data.users}
                  rowKey={(user) => user.id}
                />
                <CursorPager
                  page={cursors.length}
                  hasNext={data.nextCursor !== null}
                  disabled={query.isFetching}
                  hint={
                    sort === 'level' || sort === 'games_played'
                      ? '此排序只包含有战绩记录的用户'
                      : '每页最多 50 人'
                  }
                  onPrevious={() => setCursors(cursors.slice(0, -1))}
                  onNext={() => {
                    if (data.nextCursor !== null) setCursors([...cursors, data.nextCursor]);
                  }}
                />
              </>
            )}
          </AsyncBoundary>
        </Panel>
      </div>
      {selected !== null && (
        <UserDetails key={selected.id} user={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function userColumns(
  sortable: (key: string) => Pick<TableColumn<AdminUser>, 'sort' | 'onSort'>,
  onSelect: (user: AdminUser) => void,
): TableColumn<AdminUser>[] {
  return [
    {
      key: 'name',
      label: '用户',
      render: (user) => (
        <button
          type="button"
          className="admin-user-link"
          aria-label={`查看${user.displayName ?? '匿名用户'}的详情`}
          onClick={() => onSelect(user)}
        >
          <span className="admin-avatar" data-anonymous={user.isAnonymous}>
            {(user.displayName ?? '匿').slice(0, 1)}
          </span>
          <span>
            {user.displayName ?? '匿名用户'}
            <small>{user.email ?? user.id}</small>
          </span>
        </button>
      ),
    },
    {
      key: 'type',
      label: '类型',
      render: (user) => <StatusBadge>{user.isAnonymous ? '匿名' : '已注册'}</StatusBadge>,
    },
    {
      key: 'level',
      label: '等级',
      numeric: true,
      ...sortable('level'),
      render: (user) => user.level,
    },
    {
      key: 'xp',
      label: 'XP',
      numeric: true,
      secondary: true,
      render: (user) => formatNumber(user.xp),
    },
    {
      key: 'games',
      label: '局数',
      numeric: true,
      ...sortable('games_played'),
      render: (user) => formatNumber(user.gamesPlayed),
    },
    {
      key: 'location',
      label: '地区 · 节点',
      secondary: true,
      render: (user) => `${user.lastCountry ?? '未知'} · ${user.lastColo ?? '未知'}`,
    },
    {
      key: 'created',
      label: '注册日期',
      secondary: true,
      ...sortable('created_at'),
      render: (user) => <DateLabel value={user.createdAt} />,
    },
    {
      key: 'updated',
      label: '最近活跃',
      secondary: true,
      ...sortable('updated_at'),
      render: (user) => <DateLabel value={user.updatedAt} />,
    },
  ];
}

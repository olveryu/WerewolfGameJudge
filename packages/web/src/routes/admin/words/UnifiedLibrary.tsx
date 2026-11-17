/**
 * The unified word library: inventory numbers and the submission stream on
 * one page. Supply-produced words enter as submissions (agent '系统补词'),
 * reviewed and published exactly like agent submissions. Inventory appears
 * as numbers only; the card stream never holds inventory rows. The card
 * stream is the only review surface: review and publish happen in its bulk
 * bar and in the item drawer.
 */
import './wordSubmissions.css';

import {
  GAME_WORD_GAMES,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import type {
  GameWordGame,
  GameWordsStats,
  WordLibraryItems,
  WordSubmissionStatus,
} from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import {
  fetchGameWordsStats,
  fetchLibraryItems,
  fetchTavilyUsage,
  triggerGameWordSupply,
} from '@/features/admin/services/adminApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { AsyncBoundary, PageHeading, Panel, StatTile } from '../components/Primitives';
import { type SupplyAction, SupplyControls } from '../components/SupplyControls';
import { LibraryCards } from './LibraryCards';
import { SUBMISSION_STATUS_LABELS, WORD_GAME_LABELS, WordChoiceFilter } from './wordLabels';

const wordLog = log.extend('AdminWords');

/** Submission statuses, in the order they appear in the status filter. */
const SUBMISSION_STATUSES: readonly WordSubmissionStatus[] = [
  ...wordSubmissionStatusSchema.options,
];

function isLibraryStatus(value: string): value is WordSubmissionStatus {
  return SUBMISSION_STATUSES.some((status) => status === value);
}

/** Status filter options: the submission set. */
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...SUBMISSION_STATUSES.map((value) => ({
    value,
    label: SUBMISSION_STATUS_LABELS[value],
  })),
];
const LIBRARY_SUMMARY_STATUSES = [
  'approved',
  'reviewing',
  'passed',
  'published',
  'failed',
  'dismissed',
] as const satisfies readonly WordSubmissionStatus[];
const CATEGORY_NAME_COLLATOR = new Intl.Collator('zh-CN');

/** Merged totals are partial records: a status with no rows is absent, not zero. */
function statusCount(counts: Partial<Record<string, number>>, status: string): number {
  return counts[status] ?? 0;
}

function LibrarySummary({
  stats,
  totals,
}: {
  stats: GameWordsStats;
  totals: WordLibraryItems['totals'];
}) {
  const accepted = stats.reviewDecisions.find((item) => item.decision === 'accepted')?.count ?? 0;
  const decisions = stats.reviewDecisions.reduce((sum, item) => sum + item.count, 0);
  const inventory = stats.categories.reduce((sum, item) => sum + item.active, 0);
  return (
    <section className="admin-library-stats" aria-label="词库概览">
      <div className="admin-library-stats-row">
        <StatTile
          label="在库词数"
          value={formatNumber(inventory)}
          hint="已入库，可直接被抽题用。"
        />
        <StatTile
          label="投稿审核通过率"
          value={decisions === 0 ? '—' : `${Math.round((accepted / decisions) * 100)}%`}
          hint="模型审核有结论的投稿中通过的占比，人工通过不计入。"
        />
        <span className="admin-library-stat-hot">
          <StatTile
            label="待你批准"
            value={formatNumber(statusCount(totals.submissions, 'pending'))}
            hint="投稿中，还没批的。"
          />
        </span>
      </div>
      <div className="admin-library-status-grid">
        {LIBRARY_SUMMARY_STATUSES.map((status) => (
          <div className="admin-library-status" key={status}>
            <span>{SUBMISSION_STATUS_LABELS[status]}</span>
            <strong>{formatNumber(statusCount(totals.submissions, status))}</strong>
          </div>
        ))}
      </div>
      <p className="admin-library-scope-note">以上数据为全量统计，不受下方筛选影响。</p>
    </section>
  );
}

export function UnifiedLibrary({ game }: { game: GameWordGame }) {
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const search = parameters.get('search') ?? '';
  const category = parameters.get('category') ?? '';
  const rawStatus = parameters.get('status') ?? '';
  const status = isLibraryStatus(rawStatus) ? rawStatus : '';

  // Card-stream keyset cursors, scoped to one game and one filter set: a
  // cursor taken from another list would silently skip rows in this one.
  // Reset while rendering the new scope, so the query below never fires
  // with a stale cursor.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [prevScope, setPrevScope] = useState({ game, status, search, category });
  if (
    prevScope.game !== game ||
    prevScope.status !== status ||
    prevScope.search !== search ||
    prevScope.category !== category
  ) {
    setPrevScope({ game, status, search, category });
    setCursors([null]);
  }
  const cursor = cursors[cursors.length - 1] ?? null;

  const stats = useQuery(
    adminQueryOptions('words', game, (signal) => fetchGameWordsStats(game, signal)),
  );
  const tavily = useQuery({
    ...adminQueryOptions('tavily-usage', null, fetchTavilyUsage),
    enabled: game === 'fibking',
  });
  const library = useQuery({
    ...adminQueryOptions(
      'words',
      { game, section: 'library', status, category, search, cursor },
      (signal) =>
        fetchLibraryItems(
          game,
          {
            ...(status === '' ? {} : { status }),
            ...(category === '' ? {} : { category }),
            ...(search === '' ? {} : { search }),
            ...(cursor === null ? {} : { cursor }),
          },
          signal,
        ),
    ),
    placeholderData: keepPreviousData,
  });

  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState('');
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const busy = useRef(false);

  async function trigger(action: SupplyAction) {
    if (busy.current) return;
    busy.current = true;
    setTriggering(true);
    setNotice('');
    setTriggerError(null);
    let completed = 0;
    try {
      for (; completed < action.count; completed += 1)
        await triggerGameWordSupply(game, action.category);
      setNotice(`已触发 ${completed} 次，工作流需要几分钟，稍后手动刷新。`);
    } catch (cause: unknown) {
      handleError(cause, { label: '触发补词', logger: wordLog, feedback: false });
      setTriggerError(
        `已确认触发 ${completed} 次，其后一次结果未确认，请核对后再操作。${cause instanceof Error ? cause.message : '请求失败'}`,
      );
    } finally {
      busy.current = false;
      setTriggering(false);
    }
  }

  function confirm(action: SupplyAction) {
    void showAlert(
      '确认补词',
      `将为「${WORD_GAME_LABELS[game]}」的「${stats.data?.categories.find((item) => item.id === action.category)?.name ?? action.category}」类别触发 ${action.count} 次补词，确定吗？`,
      [
        CANCEL_BUTTON,
        {
          text: '确定',
          style: 'default',
          onPress: () => void trigger(action),
        },
      ],
    );
  }

  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value === '') next.delete(key);
    else next.set(key, value);
    setParameters(next, { replace: true });
  }

  /** Category values are game-specific; status and search are shared. */
  function gameSearch() {
    const next = new URLSearchParams();
    if (status !== '') next.set('status', status);
    if (search !== '') next.set('search', search);
    const query = next.toString();
    return query === '' ? '' : `?${query}`;
  }

  const totals = library.data?.totals;
  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count:
      totals === undefined
        ? undefined
        : option.value === ''
          ? Object.values(totals.submissions).reduce((sum, count) => sum + count, 0)
          : statusCount(totals.submissions, option.value),
  }));
  const categories = stats.data?.categories ?? [];
  const sortedCategories = categories.toSorted((left, right) =>
    CATEGORY_NAME_COLLATOR.compare(left.name, right.name),
  );
  const supplyCategories = sortedCategories.filter(
    (item) => item.id !== 'unclassified' && item.id !== 'other',
  );
  const categoryOptions = [
    { value: '', label: '全部类别' },
    ...sortedCategories.map((item) => ({
      value: item.id,
      label: `${item.name}（${formatNumber(item.active)}）`,
    })),
  ];
  return (
    <div className="admin-word-library-page">
      <PageHeading
        title="统一词库"
        description="筛选投稿；库存只显示数量。"
        query={stats}
        action={
          <span className="admin-row-actions">
            <button
              type="button"
              onClick={() => void navigate(`/admin/agents/${game}`, { replace: true })}
            >
              Agent 授权
            </button>
            <SupplyControls
              categories={supplyCategories}
              disabled={triggering || !stats.data?.supplyEnabled || supplyCategories.length === 0}
              triggering={triggering}
              gameLabel={WORD_GAME_LABELS[game]}
              onSelect={confirm}
            />
          </span>
        }
      />
      <div className="admin-content">
        {notice !== '' && (
          <p role="status" className="admin-notice">
            {notice}
          </p>
        )}
        {triggerError !== null && (
          <p role="alert" className="admin-error-box">
            {triggerError}
          </p>
        )}
        <div className="admin-toolbar">
          <nav className="admin-segmented" aria-label="选择词库">
            {GAME_WORD_GAMES.map((item) => (
              <Link
                key={item}
                to={`/admin/words/${item}${gameSearch()}`}
                replace
                aria-current={item === game ? 'page' : undefined}
              >
                {WORD_GAME_LABELS[item]}
              </Link>
            ))}
          </nav>
        </div>
        {stats.isError || library.isError ? (
          <p className="admin-muted">词库数据加载失败，请刷新重试。</p>
        ) : stats.data === undefined || totals === undefined ? (
          <p className="admin-muted">正在加载词库数据…</p>
        ) : (
          <LibrarySummary stats={stats.data} totals={totals} />
        )}
        {game === 'fibking' && (
          <Panel
            title="Tavily · 官方账户用量"
            description="来自 Tavily /usage，单位为 credits；包含账号下其他 API Key 的用量，不是本站请求次数。"
          >
            <AsyncBoundary query={tavily}>
              {(data) => (
                <div className="admin-stats-grid">
                  <StatTile label="套餐已用 credits" value={data.planUsage} />
                  <StatTile label="套餐额度 credits" value={data.planLimit ?? '未提供'} />
                  <StatTile label="按量付费已用 credits" value={data.paygoUsage} />
                  <StatTile label="按量付费上限 credits" value={data.paygoLimit ?? '未提供'} />
                </div>
              )}
            </AsyncBoundary>
          </Panel>
        )}
        <form
          className="admin-toolbar admin-library-filter-toolbar"
          aria-label="筛选词库"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams(parameters);
            const entry = new FormData(event.currentTarget).get('librarySearch');
            const value = typeof entry === 'string' ? entry.trim() : '';
            if (value !== '') next.set('search', value);
            else next.delete('search');
            setParameters(next, { replace: true });
          }}
        >
          <div className="admin-library-filter-choices">
            <WordChoiceFilter
              label="状态"
              value={status}
              options={statusOptions}
              onChange={(value) => change('status', value)}
            />
            <WordChoiceFilter
              label="类别"
              value={category}
              options={categoryOptions}
              onChange={(value) => change('category', value)}
            />
          </div>
          <input
            type="search"
            name="librarySearch"
            defaultValue={search}
            className="admin-input admin-filter"
            placeholder="搜索投稿词语"
            aria-label="搜索投稿"
          />
          <button type="submit">搜</button>
        </form>
        {library.isPlaceholderData && (
          <p role="status" className="admin-muted">
            正在更新筛选结果，暂时显示上次结果…
          </p>
        )}
        <div aria-busy={library.isFetching} inert={library.isPlaceholderData}>
          <AsyncBoundary query={library}>
            {(data) => (
              <LibraryCards
                key={`${game}:${status}:${category}:${search}:${cursors.length}`}
                game={game}
                status={status}
                search={search}
                data={data}
                page={cursors.length}
                onPrevious={() => setCursors((current) => current.slice(0, -1))}
                onNext={() => {
                  if (data.nextCursor !== null)
                    setCursors((current) => [...current, data.nextCursor]);
                }}
              />
            )}
          </AsyncBoundary>
        </div>
      </div>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

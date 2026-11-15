/**
 * The unified word library: inventory numbers and the merged FIFO stream of
 * supply candidates and submission items on one page. Inventory appears as
 * numbers only; the card stream never holds inventory rows. The batch table
 * sits below the stream, and a batch's detail opens as a workspace overlay
 * on top of this page.
 */
import './wordSubmissions.css';

import {
  GAME_WORD_GAMES,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import type {
  GameWordGame,
  GameWordsStats,
  WordCandidateListStatus,
  WordLibraryItems,
  WordSubmissionStatus,
} from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import {
  fetchGameWordsStats,
  fetchLibraryItems,
  triggerGameWordSupply,
} from '@/features/admin/services/adminApi';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { Meter } from '../components/Charts';
import {
  AsyncBoundary,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatTile,
  StatusBadge,
} from '../components/Primitives';
import { type SupplyAction, SupplyControls } from '../components/SupplyControls';
import { LibraryCards, type LibrarySourceFilter } from './LibraryCards';
import { SubmissionBatchPage } from './SubmissionBatch';
import {
  isSubmissionBatchOpenedFromLibrary,
  SUBMISSION_BATCH_ORIGIN_STATE,
} from './submissionBatchNavigation';
import {
  CANDIDATE_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
  WordChoiceFilter,
} from './wordLabels';

const wordLog = log.extend('AdminWords');

/** Card-stream source filter values carried in the `source` URL param. */
const LIBRARY_SOURCES: readonly string[] = ['all', 'inventory', 'submissions'];

function isLibrarySource(value: string): value is LibrarySourceFilter {
  return LIBRARY_SOURCES.includes(value);
}

/** Candidate statuses, in the order they appear in the status filter. */
const CANDIDATE_STATUSES: readonly WordCandidateListStatus[] = [
  'pending',
  'approved',
  'claimed',
  'accepted',
  'rejected',
];

/** Submission statuses, in the order they appear in the status filter. */
const SUBMISSION_STATUSES: readonly WordSubmissionStatus[] = [
  ...wordSubmissionStatusSchema.options,
];

function isLibraryStatus(value: string): value is WordCandidateListStatus | WordSubmissionStatus {
  return (
    CANDIDATE_STATUSES.some((status) => status === value) ||
    SUBMISSION_STATUSES.some((status) => status === value)
  );
}

/** Status filter options: the candidate set followed by the submission set. */
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...CANDIDATE_STATUSES.map((value) => ({
    value,
    label: CANDIDATE_STATUS_LABELS[value],
  })),
  ...SUBMISSION_STATUSES.map((value) => ({
    value,
    label: SUBMISSION_STATUS_LABELS[value],
  })),
];

/** Merged totals are partial records: a status with no rows is absent, not zero. */
function statusCount(counts: Partial<Record<string, number>>, status: string): number {
  return counts[status] ?? 0;
}

function LibraryFlowBar({
  stats,
  totals,
}: {
  stats: GameWordsStats;
  totals: WordLibraryItems['totals'];
}) {
  const awaiting =
    statusCount(totals.candidates, 'pending') +
    statusCount(totals.candidates, 'approved') +
    statusCount(totals.submissions, 'pending') +
    statusCount(totals.submissions, 'approved');
  const inventory = stats.categories.reduce((sum, item) => sum + item.active, 0);
  const stages = [
    { label: '库存', value: inventory, hot: false },
    { label: '待审核', value: awaiting, hot: awaiting > 0 },
    { label: '审核中', value: statusCount(totals.submissions, 'reviewing'), hot: false },
    { label: '待发布', value: statusCount(totals.submissions, 'passed'), hot: false },
  ];
  return (
    <ol className="admin-flow-bar" aria-label="词库流程">
      {stages.map((stage) => (
        <li
          key={stage.label}
          className={stage.hot ? 'admin-flow-step admin-flow-step-hot' : 'admin-flow-step'}
        >
          <span className="admin-flow-step-value">{stage.value}</span>
          <span className="admin-flow-step-label">
            {stage.label}
            {stage.hot ? ' · 待处理' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
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
    <div className="admin-library-stats">
      <div className="admin-library-stats-row">
        <StatTile label="在库词数" value={inventory} hint="已入库，可直接被抽题用。" />
        <StatTile
          label="后台候选审核通过率"
          value={decisions === 0 ? '—' : `${Math.round((accepted / decisions) * 100)}%`}
          hint="近 30 天后台候选的模型审核通过占比，不包括 Agent 投稿。"
        />
        <span className="admin-library-stat-hot">
          <StatTile
            label="待你批准"
            value={
              statusCount(totals.candidates, 'pending') + statusCount(totals.submissions, 'pending')
            }
            hint="后台生成的候选与外部投稿中，还没批的。"
          />
        </span>
      </div>
      <div className="admin-library-summary-supplementary">
        <span className="admin-library-summary-line">
          <span className="admin-library-summary-key">已批准待审核</span>
          <span className="admin-library-summary-value">
            {formatNumber(
              statusCount(totals.candidates, 'approved') +
                statusCount(totals.submissions, 'approved'),
            )}{' '}
            条
          </span>
        </span>
        <span className="admin-library-summary-line">
          <span className="admin-library-summary-key">已拒绝</span>
          <span className="admin-library-summary-value">
            {formatNumber(statusCount(totals.submissions, 'dismissed'))} 条
          </span>
        </span>
      </div>
    </div>
  );
}

export function UnifiedLibrary({ game }: { game: GameWordGame }) {
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const search = parameters.get('search') ?? '';
  const rawSource = parameters.get('source') ?? '';
  const source = isLibrarySource(rawSource) ? rawSource : 'all';
  const rawStatus = parameters.get('status') ?? '';
  const status = isLibraryStatus(rawStatus) ? rawStatus : '';
  const batchId = parameters.get('batch');
  const batchCursor = parameters.get('batchCursor');
  const openedFromLibrary = isSubmissionBatchOpenedFromLibrary(location.state);

  // Card-stream keyset cursors, scoped to one game and one filter set: a
  // cursor taken from another list would silently skip rows in this one.
  // Reset while rendering the new scope, so the query below never fires
  // with a stale cursor.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [prevScope, setPrevScope] = useState({ game, source, status, search });
  if (
    prevScope.game !== game ||
    prevScope.source !== source ||
    prevScope.status !== status ||
    prevScope.search !== search
  ) {
    setPrevScope({ game, source, status, search });
    setCursors([null]);
  }
  const cursor = cursors[cursors.length - 1] ?? null;

  const stats = useQuery(
    adminQueryOptions('words', game, (signal) => fetchGameWordsStats(game, signal)),
  );
  const library = useQuery(
    adminQueryOptions(
      'words',
      { game, section: 'library', source, status, search, cursor },
      (signal) =>
        fetchLibraryItems(
          game,
          {
            ...(source === 'submissions' ? { source: 'submission' as const } : {}),
            ...(status === '' ? {} : { status }),
            ...(search === '' ? {} : { search }),
            ...(cursor === null ? {} : { cursor }),
          },
          signal,
        ),
    ),
  );
  const batches = useQuery(
    adminQueryOptions(
      'word-submissions',
      { kind: 'batches', game, cursor: batchCursor ?? undefined },
      (signal) =>
        wordSubmissionsApi.batches(
          { game, ...(batchCursor === null ? {} : { cursor: batchCursor }) },
          signal,
        ),
    ),
  );

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
        await triggerGameWordSupply(game, action.force);
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
    const limit =
      game === 'fibking'
        ? `突破本月 ${stats.data?.monthlySupply?.batchLimit ?? '—'} 次配额及共享模型额度`
        : '突破每日批次上限及共享模型额度';
    void showAlert(
      '确认补词',
      `将为「${WORD_GAME_LABELS[game]}」${action.force ? '强制' : ''}触发 ${action.count} 次补词${action.force ? `，${limit}` : ''}，确定吗？`,
      [
        CANCEL_BUTTON,
        {
          text: '确定',
          style: action.force ? 'destructive' : 'default',
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

  function openBatch(id: string) {
    const next = new URLSearchParams(parameters);
    next.set('batch', id);
    setParameters(next, { replace: false, state: SUBMISSION_BATCH_ORIGIN_STATE });
  }

  function closeBatch() {
    if (isSubmissionBatchOpenedFromLibrary(location.state)) {
      void navigate(-1);
      return;
    }
    const next = new URLSearchParams(parameters);
    next.delete('batch');
    setParameters(next, { replace: true });
  }

  /** Game links keep the card-stream filters and drop the batch overlay. */
  function gameSearch() {
    const next = new URLSearchParams();
    if (source !== 'all') next.set('source', source);
    if (status !== '') next.set('status', status);
    if (search !== '') next.set('search', search);
    const query = next.toString();
    return query === '' ? '' : `?${query}`;
  }

  /** Batch links keep the card-stream filters and add the batch overlay. */
  const batchLinkFilter: Record<string, string> = {};
  if (source !== 'all') batchLinkFilter.source = source;
  if (status !== '') batchLinkFilter.status = status;
  if (search !== '') batchLinkFilter.search = search;
  if (batchCursor !== null) batchLinkFilter.batchCursor = batchCursor;

  const totals = library.data?.totals;
  const inventory = stats.data?.categories.reduce((sum, item) => sum + item.active, 0) ?? 0;
  return (
    <>
      {(batchId === null || openedFromLibrary) && (
        <>
          <PageHeading
            title="统一词库"
            description="搜索后台候选和 Agent 投稿；库存只显示数量。"
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
                  disabled={triggering || !stats.data?.supplyEnabled}
                  triggering={triggering}
                  gameLabel={WORD_GAME_LABELS[game]}
                  remainingBudget={
                    stats.data === undefined
                      ? 0
                      : Math.max(
                          0,
                          Math.min(
                            stats.data.modelBudget.dailyLimit - stats.data.modelBudget.dailyUsed,
                            stats.data.modelBudget.monthlyLimit -
                              stats.data.modelBudget.monthlyUsed,
                          ),
                        )
                  }
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
              <p className="admin-muted">流程汇总加载失败，见下方各表。</p>
            ) : stats.data === undefined || totals === undefined ? (
              <p className="admin-muted">正在汇总流程…</p>
            ) : (
              <>
                <LibrarySummary stats={stats.data} totals={totals} />
                <dl className="admin-details admin-library-sources">
                  <dt>库存</dt>
                  <dd>{formatNumber(inventory)} 条</dd>
                  <dt>Agent 已发布</dt>
                  <dd>{formatNumber(statusCount(totals.submissions, 'published'))} 条</dd>
                  <dt>Agent 待批准</dt>
                  <dd>{formatNumber(statusCount(totals.submissions, 'pending'))} 条</dd>
                  <dt>审核失败待重审</dt>
                  <dd>{formatNumber(statusCount(totals.submissions, 'failed'))} 条</dd>
                </dl>
                <LibraryFlowBar stats={stats.data} totals={totals} />
                {stats.data.tavilyRequestsUsed !== null &&
                  stats.data.tavilyMonthlyQuota !== null && (
                    <Meter
                      label="Tavily · 本月"
                      value={stats.data.tavilyRequestsUsed}
                      limit={stats.data.tavilyMonthlyQuota}
                    />
                  )}
              </>
            )}
            <form
              className="admin-toolbar"
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
              <nav className="admin-segmented" aria-label="筛选来源">
                <Link
                  to={`/admin/words/${game}`}
                  replace
                  aria-current={source === 'all' ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    change('source', '');
                  }}
                >
                  全部来源
                </Link>
                <Link
                  to={`/admin/words/${game}`}
                  replace
                  aria-current={source === 'inventory' ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    change('source', 'inventory');
                  }}
                >
                  库存
                </Link>
                <Link
                  to={`/admin/words/${game}`}
                  replace
                  aria-current={source === 'submissions' ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    change('source', 'submissions');
                  }}
                >
                  Agent 投稿
                </Link>
              </nav>
              <WordChoiceFilter
                label="状态"
                value={status}
                options={STATUS_OPTIONS}
                onChange={(value) => change('status', value)}
              />
              <input
                type="search"
                name="librarySearch"
                defaultValue={search}
                className="admin-input admin-filter"
                placeholder="搜索候选或投稿的词语、分类"
                aria-label="搜索候选或投稿"
              />
              <button type="submit">搜</button>
            </form>
            <AsyncBoundary query={library}>
              {(data) => (
                <LibraryCards
                  key={`${game}:${source}:${status}:${search}`}
                  game={game}
                  source={source}
                  status={status}
                  search={search}
                  data={data}
                  page={cursors.length}
                  onPrevious={() => setCursors((current) => current.slice(0, -1))}
                  onOpenBatch={openBatch}
                  onNext={() => {
                    if (data.nextCursor !== null)
                      setCursors((current) => [...current, data.nextCursor]);
                  }}
                />
              )}
            </AsyncBoundary>
            <Panel title="外部投稿批次">
              <AsyncBoundary query={batches}>
                {(data) => (
                  <>
                    <SubmissionBatchesTable
                      batches={data.batches}
                      filter={batchLinkFilter}
                      onOpen={openBatch}
                    />
                    {data.batches.length === 0 && (
                      <p className="admin-submission-empty">暂无批次。</p>
                    )}
                    <footer className="admin-pagination">
                      <span className="admin-muted">本页 {data.batches.length} 个批次</span>
                      <div>
                        {batchCursor !== null && (
                          <button type="button" onClick={() => change('batchCursor', '')}>
                            返回第一页
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={data.nextCursor === null || batches.isFetching}
                          onClick={() => {
                            if (data.nextCursor !== null) change('batchCursor', data.nextCursor);
                          }}
                        >
                          下一页
                        </button>
                      </div>
                    </footer>
                  </>
                )}
              </AsyncBoundary>
            </Panel>
          </div>
        </>
      )}
      {batchId !== null && (
        <SubmissionBatchPage key={batchId} batchId={batchId} onClose={closeBatch} />
      )}
    </>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function SubmissionBatchesTable({
  batches,
  filter,
  onOpen,
}: {
  batches: Awaited<ReturnType<typeof wordSubmissionsApi.batches>>['batches'];
  filter: Record<string, string>;
  onOpen: (batchId: string) => void;
}) {
  function batchSearch(batchId: string) {
    return `?${new URLSearchParams({ ...filter, batch: batchId })}`;
  }
  return (
    <DataTable
      caption="投稿批次"
      rows={batches}
      rowKey={(batch) => batch.id}
      rowLabel={(batch) => `打开投稿批次 ${batch.id}`}
      onRowClick={(batch) => onOpen(batch.id)}
      columns={[
        {
          key: 'id',
          label: '批次',
          render: (batch) => (
            <Link
              className="admin-submission-id"
              to={batchSearch(batch.id)}
              state={SUBMISSION_BATCH_ORIGIN_STATE}
            >
              {batch.id}
            </Link>
          ),
        },
        { key: 'game', label: '游戏', render: (batch) => WORD_GAME_LABELS[batch.game] },
        {
          key: 'source',
          label: '来源',
          render: (batch) => <StatusBadge title={batch.agentName}>Agent投稿</StatusBadge>,
        },
        {
          key: 'agent',
          label: '投稿方',
          secondary: true,
          render: (batch) => batch.agentName,
        },
        {
          key: 'count',
          label: '候选',
          numeric: true,
          secondary: true,
          render: (batch) =>
            Object.values(batch.counts).reduce((sum, count) => sum + (count ?? 0), 0),
        },
        {
          key: 'status',
          label: '处理进度',
          render: (batch) => {
            const status = wordSubmissionStatusSchema.options.find(
              (item) => (batch.counts[item] ?? 0) > 0,
            );
            return status === undefined ? '无候选' : <SubmissionStatus status={status} />;
          },
        },
        {
          key: 'duplicate',
          label: '重复提醒',
          render: (batch) =>
            batch.inventoryExists ? (
              <StatusBadge tone="danger" title="这批里有词已经在库里，发布时会被拦下">
                已有相同词在库
              </StatusBadge>
            ) : (
              <span className="admin-muted">—</span>
            ),
        },
        {
          key: 'time',
          label: '提交时间',
          secondary: true,
          render: (batch) => <DateLabel value={batch.createdAt} />,
        },
      ]}
    />
  );
}

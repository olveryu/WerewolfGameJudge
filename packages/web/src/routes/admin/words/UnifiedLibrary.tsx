/** One page for inventory and external submissions, with unified search.
 * Merges the two existing reads (game stats + submission batches) on the
 * client; no new aggregation endpoint. Batch rows link out to the
 * submissions workspace, which owns the batch overlay. */
import { wordSubmissionStatusSchema } from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';

import type {
  GameWordGame,
  GameWordsStats,
  WordCandidateListStatus,
} from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchGameWordsStats } from '@/features/admin/services/adminApi';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';

import {
  AsyncBoundary,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatusBadge,
} from '../components/Primitives';
import { PendingCandidates } from './PendingCandidates';
import { SUBMISSION_BATCH_ORIGIN_STATE } from './submissionBatchNavigation';
import {
  CANDIDATE_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
  WordChoiceFilter,
  WordSections,
} from './WordSections';

type LibrarySource = 'all' | 'inventory' | 'submissions';

const SOURCE_LABELS: Record<Exclude<LibrarySource, 'all'>, string> = {
  inventory: '库存',
  submissions: 'Agent投稿',
};

/** Candidate statuses share pending/approved/rejected with submission items. */
const CANDIDATE_STATUSES: readonly string[] = [
  'pending',
  'approved',
  'claimed',
  'accepted',
  'rejected',
];
const SUBMISSION_STATUSES: readonly string[] = wordSubmissionStatusSchema.options;

function isCandidateStatus(value: string): value is WordCandidateListStatus {
  return CANDIDATE_STATUSES.includes(value);
}

function isSubmissionStatus(value: string): boolean {
  return SUBMISSION_STATUSES.includes(value);
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...(['pending', 'approved', 'claimed', 'accepted', 'rejected'] as const).map((value) => ({
    value,
    label: CANDIDATE_STATUS_LABELS[value],
  })),
  ...(['reviewing', 'passed', 'failed', 'published', 'dismissed'] as const).map((value) => ({
    value,
    label: SUBMISSION_STATUS_LABELS[value],
  })),
];

export function UnifiedLibrary({ game }: { game: GameWordGame }) {
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const search = parameters.get('search') ?? '';
  const source = (parameters.get('source') as LibrarySource | null) ?? 'all';
  const status = parameters.get('status') ?? '';
  const candidateStatus = isCandidateStatus(status) ? status : null;
  const isCandidateOnlyStatus = candidateStatus !== null && !isSubmissionStatus(status);
  const isSubmissionOnlyStatus = status !== '' && candidateStatus === null;
  // Both reads stay enabled in every source: the batches totals and the
  // stats feed the flow bar even when their panel is hidden, so neither
  // query can be gated on the source filter.
  const stats = useQuery(
    adminQueryOptions('words', game, (signal) => fetchGameWordsStats(game, signal)),
  );
  const batchFilter: Record<string, string> = { game };
  if (search !== '') batchFilter.search = search;
  // The batches route rejects statuses outside the submission enum, so a
  // candidate-only status hides the batches panel instead of filtering it.
  if (status !== '' && isSubmissionStatus(status)) batchFilter.status = status;
  const cursor = parameters.get('cursor');
  if (cursor !== null) batchFilter.cursor = cursor;
  const batches = useQuery(
    adminQueryOptions('word-submissions', { kind: 'batches', ...batchFilter }, (signal) =>
      wordSubmissionsApi.batches(batchFilter, signal),
    ),
  );
  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (key !== 'cursor') next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    setParameters(next, { replace: true });
  }
  return (
    <>
      <PageHeading
        title="统一词库"
        description="库存与外部投稿放在一页：搜一次，两处都出结果；投稿行带重复提醒。"
        query={stats}
        controls={<WordSections game={game} section="library" />}
      />
      <div className="admin-content">
        {stats.isError || batches.isError ? (
          <p className="admin-muted">流程汇总加载失败，见下方各表。</p>
        ) : stats.data === undefined || batches.data === undefined ? (
          <p className="admin-muted">正在汇总流程…</p>
        ) : (
          <LibraryFlowBar stats={stats.data} totals={batches.data.totals} />
        )}
        <div className="admin-toolbar">
          <div className="admin-segmented" role="group" aria-label="来源">
            {(
              [
                ['all', '全部来源'],
                ['inventory', '库存'],
                ['submissions', 'Agent投稿'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={source === value}
                onClick={() => change('source', value === 'all' ? '' : value)}
              >
                {label}
              </button>
            ))}
          </div>
          <WordChoiceFilter
            label="状态"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(value) => change('status', value)}
          />
          <form
            className="admin-submission-search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('search');
              if (typeof value !== 'string') throw new Error('Search form is missing its input');
              change('search', value.trim());
            }}
          >
            <input
              key={search}
              name="search"
              defaultValue={search}
              maxLength={96}
              aria-label="搜索分类或批次编号"
              placeholder="分类或批次编号"
            />
            <button type="submit">搜索</button>
          </form>
          <button
            type="button"
            className="admin-text-button"
            disabled={search === '' && source === 'all' && status === ''}
            onClick={() => {
              const next = new URLSearchParams(parameters);
              next.delete('search');
              next.delete('source');
              next.delete('status');
              next.delete('cursor');
              setParameters(next, { replace: true });
            }}
          >
            清空筛选
          </button>
        </div>
        <div className="admin-grid">
          {source !== 'submissions' && (
            <Panel title="库存分类" className="admin-span-12">
              <AsyncBoundary query={stats}>
                {(data) => <InventoryTable data={data} search={search} />}
              </AsyncBoundary>
            </Panel>
          )}
          {source !== 'submissions' && !isSubmissionOnlyStatus && (
            <PendingCandidates game={game} status={candidateStatus ?? 'pending'} />
          )}
          {source !== 'inventory' && !isCandidateOnlyStatus && (
            <Panel title="外部投稿批次" className="admin-span-12">
              <AsyncBoundary query={batches}>
                {(data) => (
                  <>
                    <SubmissionBatchesTable
                      batches={data.batches}
                      filter={batchFilter}
                      onOpen={(batchId) => {
                        const next = new URLSearchParams({
                          ...batchFilter,
                          section: 'submissions',
                          batch: batchId,
                        });
                        void navigate(`?${next}`, { state: SUBMISSION_BATCH_ORIGIN_STATE });
                      }}
                    />
                    {data.batches.length === 0 && (
                      <p className="admin-submission-empty">没有匹配的投稿，试试其他筛选条件。</p>
                    )}
                    <footer className="admin-pagination">
                      <span className="admin-muted">本页 {data.batches.length} 个批次</span>
                      <div>
                        {cursor !== null && (
                          <button type="button" onClick={() => change('cursor', '')}>
                            返回第一页
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={data.nextCursor === null || batches.isFetching}
                          onClick={() => {
                            if (data.nextCursor !== null) change('cursor', data.nextCursor);
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
          )}
        </div>
      </div>
    </>
  );
}

/** Five-stage pipeline summary. Stage 2 is the pre-review queue on both sides:
 * the supply queue (stats pending, per category) plus submission items still
 * waiting for endorse (pending + approved). */
function LibraryFlowBar({
  stats,
  totals,
}: {
  stats: GameWordsStats;
  totals: Awaited<ReturnType<typeof wordSubmissionsApi.batches>>['totals'];
}) {
  const inventory = stats.categories.reduce((sum, item) => sum + item.active, 0);
  const awaiting =
    stats.categories.reduce((sum, item) => sum + item.pending, 0) +
    (totals.pending ?? 0) +
    (totals.approved ?? 0);
  const stages = [
    { label: '库存', value: inventory, hot: false },
    { label: '待审核', value: awaiting, hot: awaiting > 0 },
    { label: '审核中', value: totals.reviewing ?? 0, hot: false },
    { label: '待发布', value: totals.passed ?? 0, hot: false },
    { label: '本月已发布', value: stats.monthlySupply?.published ?? 0, hot: false },
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

function InventoryTable({ data, search }: { data: GameWordsStats; search: string }) {
  const query = search.trim().toLowerCase();
  const categories = [...data.categories]
    .filter(
      (item) =>
        query === '' ||
        item.name.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query),
    )
    .sort((a, b) => a.active - b.active || a.id.localeCompare(b.id));
  if (categories.length === 0) return <p className="admin-muted">没有匹配的分类。</p>;
  return (
    <DataTable
      caption="库存分类"
      rows={categories}
      rowKey={(item) => item.id}
      columns={[
        { key: 'name', label: '分类', render: (item) => item.name },
        {
          key: 'source',
          label: '来源',
          render: () => <StatusBadge>{SOURCE_LABELS.inventory}</StatusBadge>,
        },
        {
          key: 'stock',
          label: '在库 / 总数',
          numeric: true,
          render: (item) => `${item.active} / ${item.total}`,
        },
        {
          key: 'pending',
          label: '待审',
          numeric: true,
          secondary: true,
          render: (item) => item.pending,
        },
        {
          key: 'yield',
          label: '产出 / 批次',
          numeric: true,
          secondary: true,
          render: (item) => `${item.yieldCount} / ${item.batches}`,
        },
        {
          key: 'last',
          label: '上次补词',
          secondary: true,
          render: (item) => <DateLabel value={item.lastAttempt} />,
        },
      ]}
    />
  );
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
    return `?${new URLSearchParams({ ...filter, section: 'submissions', batch: batchId })}`;
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
          render: (batch) => (
            <StatusBadge title={batch.agentName}>{SOURCE_LABELS.submissions}</StatusBadge>
          ),
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

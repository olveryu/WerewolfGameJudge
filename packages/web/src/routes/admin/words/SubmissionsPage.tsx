/** External intake is an administrator workspace, never an automatic supply queue. */
import {
  type GameWordGame,
  type WordSubmissionSettings,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';

import {
  AsyncBoundary,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatTile,
} from '../components/Primitives';
import { SubmissionBatchPage } from './SubmissionBatch';
import { useSubmissionCommand } from './useSubmissionCommand';
import {
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
  WordChoiceFilter,
  WordSections,
} from './WordSections';

/** Keep batch navigation in the URL rather than transient drawer state. */
export function SubmissionsPage({ game }: { game: GameWordGame }) {
  const [parameters] = useSearchParams();
  const batchId = parameters.get('batch');
  return batchId === null ? (
    <SubmissionList game={game} />
  ) : (
    <SubmissionBatchPage key={batchId} game={game} batchId={batchId} />
  );
}

function SubmissionList({ game }: { game: GameWordGame }) {
  const [parameters, setParameters] = useSearchParams();
  const filter = Object.fromEntries(
    ['game', 'agent', 'status', 'search', 'cursor'].flatMap((key) => {
      const value = parameters.get(key);
      return value ? [[key, value]] : [];
    }),
  );
  const batches = useQuery(
    adminQueryOptions('word-submissions', { kind: 'batches', ...filter }, (signal) =>
      wordSubmissionsApi.batches(filter, signal),
    ),
  );
  const settings = useQuery(
    adminQueryOptions('word-submissions', { kind: 'settings' }, wordSubmissionsApi.settings),
  );
  const intake = useSubmissionCommand(async (accepting: boolean) => {
    await wordSubmissionsApi.setAccepting(accepting);
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (key !== 'cursor') next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    setParameters(next, { replace: true });
  }
  function toggle() {
    if (settings.data === undefined) return;
    const accepting = !settings.data.accepting;
    showAlert(
      accepting ? '恢复外部收稿' : '暂停外部收稿',
      '只影响新的外部投稿；已有投稿、自动补词和线上游戏不受影响。',
      [
        CANCEL_BUTTON,
        { text: accepting ? '恢复' : '暂停', onPress: () => intake.mutate(accepting) },
      ],
    );
  }
  return (
    <>
      <PageHeading
        title="词库"
        description="先看投稿与审核结果，再决定是否发布。"
        query={batches}
        controls={<WordSections game={game} section="submissions" />}
        action={
          <button
            type="button"
            disabled={settings.data === undefined || intake.isPending}
            onClick={toggle}
          >
            {settings.data?.accepting === false ? '恢复收稿' : '暂停收稿'}
          </button>
        }
      />
      <div className="admin-content admin-submission-content">
        {intake.error !== null && (
          <p role="alert" className="admin-error-box">
            {intake.error.message}
          </p>
        )}
        <AsyncBoundary query={settings}>
          {(data) => <SubmissionSummary data={data} />}
        </AsyncBoundary>
        <Panel title="投稿批次" description="只有管理员确认发布后，词条才进入游戏。" flush>
          <SubmissionFilters
            filter={filter}
            onChange={change}
            onClear={() => setParameters({ section: 'submissions' }, { replace: true })}
          />
          <AsyncBoundary query={batches}>
            {(data) => (
              <>
                <SubmissionBatchesTable batches={data.batches} filter={filter} />
                {data.batches.length === 0 && (
                  <p className="admin-submission-empty">没有匹配的投稿，试试其他筛选条件。</p>
                )}
                <footer className="admin-pagination">
                  <span className="admin-muted">本页 {data.batches.length} 个批次</span>
                  <div>
                    {filter.cursor !== undefined && (
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
      </div>
    </>
  );
}

function SubmissionFilters({
  filter,
  onChange,
  onClear,
}: {
  filter: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}) {
  const agents = useQuery(
    adminQueryOptions('word-submissions', { kind: 'agents' }, wordSubmissionsApi.agents),
  );
  const sourceOptions = [
    { value: '', label: '全部来源' },
    ...(agents.data?.agents.map((agent) => ({ value: agent.id, label: agent.name })) ?? []),
  ];
  return (
    <>
      <div className="admin-toolbar admin-submission-filters">
        <WordChoiceFilter
          label="游戏"
          value={filter.game ?? ''}
          options={[
            { value: '', label: '全部游戏' },
            ...Object.entries(WORD_GAME_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => onChange('game', value)}
        />
        <WordChoiceFilter
          label="投稿来源"
          value={filter.agent ?? ''}
          options={sourceOptions}
          onChange={(value) => onChange('agent', value)}
        />
        <WordChoiceFilter
          label="批次状态"
          value={filter.status ?? ''}
          options={[
            { value: '', label: '全部状态' },
            ...wordSubmissionStatusSchema.options.map((value) => ({
              value,
              label: SUBMISSION_STATUS_LABELS[value],
            })),
          ]}
          onChange={(value) => onChange('status', value)}
        />
        <form
          className="admin-submission-search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('search');
            if (typeof value !== 'string') throw new Error('Search form is missing its input');
            onChange('search', value.trim());
          }}
        >
          <input
            key={filter.search ?? ''}
            name="search"
            defaultValue={filter.search ?? ''}
            maxLength={96}
            aria-label="搜索批次或词语"
            placeholder="词语或批次编号（前缀）"
          />
          <button type="submit">搜索</button>
        </form>
        <button
          type="button"
          className="admin-text-button"
          disabled={Object.keys(filter).length === 0}
          onClick={onClear}
        >
          清空筛选
        </button>
      </div>
      {agents.error !== null && (
        <p role="alert" className="admin-error-box">
          来源加载失败：{agents.error.message}
        </p>
      )}
    </>
  );
}

function SubmissionSummary({ data }: { data: WordSubmissionSettings }) {
  return (
    <>
      <div className="admin-grid">
        <Panel className="admin-span-9">
          <div className="admin-stats-grid">
            <StatTile
              label="待启动审核"
              value={data.awaitingReview}
              hint="由管理员启动，调用会记账"
            />
            <StatTile
              label="待确认发布"
              value={data.awaitingPublication}
              hint={`当前已发布 ${data.published} 条外部词语`}
            />
            <StatTile label="审核失败" value={data.failed} hint="请求失败，不代表内容不合格" />
          </div>
        </Panel>
        <Panel title="审核与调用" className="admin-span-3">
          <p className="admin-muted">外部投稿需人工启动审核，确认后发布。</p>
          <dl className="admin-details">
            <dt>模型 · 近 24 小时</dt>
            <dd>{data.modelBudget.dailyUsed} 次</dd>
            <dt>模型 · 近 30 天</dt>
            <dd>{data.modelBudget.monthlyUsed} 次</dd>
          </dl>
          <p className="admin-muted">
            包含自动补词调用。外部审核不受应用额度限制；发布已通过项不再调用模型。
          </p>
        </Panel>
      </div>
      {!data.accepting && (
        <p role="status" className="admin-notice">
          已暂停外部收稿。已有批次仍可审核与发布，线上游戏不受影响。
        </p>
      )}
    </>
  );
}

function SubmissionBatchesTable({
  batches,
  filter,
}: {
  batches: Awaited<ReturnType<typeof wordSubmissionsApi.batches>>['batches'];
  filter: Record<string, string>;
}) {
  return (
    <DataTable
      caption="投稿批次"
      rows={batches}
      rowKey={(batch) => batch.id}
      columns={[
        {
          key: 'id',
          label: '批次',
          render: (batch) => (
            <Link
              className="admin-submission-id"
              to={`?${new URLSearchParams({ ...filter, section: 'submissions', batch: batch.id })}`}
              replace
            >
              {batch.id}
            </Link>
          ),
        },
        { key: 'game', label: '游戏', render: (batch) => WORD_GAME_LABELS[batch.game] },
        { key: 'agent', label: '投稿来源', secondary: true, render: (batch) => batch.agentName },
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
            const selected = wordSubmissionStatusSchema.safeParse(filter.status);
            const status = selected.success
              ? selected.data
              : wordSubmissionStatusSchema.options.find((item) => (batch.counts[item] ?? 0) > 0);
            return status === undefined ? '无候选' : <SubmissionStatus status={status} />;
          },
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

/** Candidates the supply workflows stored and are waiting for human approval. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type {
  GameWordGame,
  WordCandidateListItem,
  WordCandidateListStatus,
} from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import {
  approveWordCandidates,
  dismissWordCandidates,
  fetchWordCandidates,
} from '@/features/admin/services/adminApi';
import { showAlert, showPrompt } from '@/utils/alert';
import { log } from '@/utils/logger';

import { AsyncBoundary, CursorPager, DataTable, DateLabel, Panel } from '../components/Primitives';
import { useSubmissionCommand } from './useSubmissionCommand';

const candidateLog = log.extend('AdminWordCandidates');

const CANDIDATE_PANEL_META: Record<
  WordCandidateListStatus,
  { title: string; description: string; empty: string }
> = {
  pending: {
    title: '待批准候选',
    description: '补词生成后只入队、不自动审核发布；批准后由下一轮继续。',
    empty: '暂无待批准候选。',
  },
  approved: {
    title: '已批准候选',
    description: '已批准的候选等下一轮供题流程认领；本页只查看。',
    empty: '暂无已批准候选。',
  },
  claimed: {
    title: '已认领候选',
    description: '已被某轮供题流程认领，正在审核或等待发布；本页只查看。',
    empty: '暂无已认领候选。',
  },
  accepted: {
    title: '已通过候选',
    description: '模型审核已通过，等发布进库存；本页只查看。',
    empty: '暂无已通过候选。',
  },
  rejected: {
    title: '未通过候选',
    description: '模型审核未通过，不会发布进库存；本页只查看。',
    empty: '暂无未通过候选。',
  },
};

/** Approved candidates are claimed by the next supply run; nothing here calls the model. */
export function PendingCandidates({
  game,
  status = 'pending',
}: {
  game: GameWordGame;
  status?: WordCandidateListStatus;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const cursor = cursors[cursors.length - 1] ?? null;
  const query = useQuery(
    adminQueryOptions('words', { game, section: 'candidates', status, cursor }, (signal) =>
      fetchWordCandidates(game, { status, cursor: cursor ?? undefined }, signal),
    ),
  );
  const approve = useSubmissionCommand(
    async (input: { candidateIds: string[]; reason: string }) => {
      const result = await approveWordCandidates(game, input.candidateIds, input.reason);
      setSelected(new Set());
      setNotice(
        result.skippedIds.length === 0
          ? `已批准 ${result.approvedIds.length} 条，下一轮将继续审核。`
          : `已批准 ${result.approvedIds.length} 条，${result.skippedIds.length} 条已不在待批准队列。`,
      );
      candidateLog.info('candidates approved', { game, approved: result.approvedIds.length });
    },
    '候选批准',
  );
  const dismiss = useSubmissionCommand(
    async (input: { candidateIds: string[]; reason: string }) => {
      const result = await dismissWordCandidates(game, input.candidateIds, input.reason);
      setSelected(new Set());
      setNotice(
        result.skippedIds.length === 0
          ? `已拒绝 ${result.dismissedIds.length} 条。`
          : `已拒绝 ${result.dismissedIds.length} 条，${result.skippedIds.length} 条已不在待批准队列。`,
      );
      candidateLog.info('candidates dismissed', { game, dismissed: result.dismissedIds.length });
    },
    '候选拒绝',
  );
  function confirmApprove(candidateIds: string[]) {
    if (candidateIds.length === 0) return;
    showPrompt('批准进入审核', {
      placeholder: '为什么批准这批候选进入审核',
      onConfirm: (reason) => {
        if (reason.trim().length === 0) {
          showAlert('需要填写批准理由', '批准理由会记进审核记录，不能为空。');
          return;
        }
        approve.mutate({ candidateIds, reason });
      },
    });
  }
  function confirmDismiss(candidateIds: string[]) {
    if (candidateIds.length === 0) return;
    showPrompt('拒绝候选', {
      placeholder: '为什么拒绝这批候选',
      onConfirm: (reason) => {
        if (reason.trim().length === 0) {
          showAlert('需要填写拒绝理由', '拒绝理由会记进审核记录，不能为空。');
          return;
        }
        dismiss.mutate({ candidateIds, reason });
      },
    });
  }
  const meta = CANDIDATE_PANEL_META[status];
  const selectedIds = [...selected];
  const isPending = status === 'pending';
  const busy = approve.isPending || dismiss.isPending;
  return (
    <Panel title={meta.title} description={meta.description} className="admin-span-12">
      <AsyncBoundary query={query}>
        {(data) => {
          const items = data.candidates;
          if (items.length === 0) return <p className="admin-muted">{meta.empty}</p>;
          return (
            <>
              {notice !== '' && (
                <p role="status" className="admin-notice">
                  {notice}
                </p>
              )}
              {approve.isError && (
                <p role="alert" className="admin-error-box">
                  批准失败，请稍后重试。
                </p>
              )}
              {dismiss.isError && (
                <p role="alert" className="admin-error-box">
                  拒绝失败，请稍后重试。
                </p>
              )}
              <DataTable
                caption={meta.title}
                rows={items}
                rowKey={(item) => item.id}
                columns={[
                  {
                    key: 'select',
                    label: '选择',
                    render: (item) => (
                      <label className="admin-submission-check">
                        <input
                          type="checkbox"
                          aria-label={`选择${item.title}`}
                          checked={selected.has(item.id)}
                          onChange={(event) => {
                            const next = new Set(selected);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelected(next);
                          }}
                        />
                      </label>
                    ),
                  },
                  { key: 'title', label: '词面', render: (item) => item.title },
                  {
                    key: 'category',
                    label: '主题',
                    secondary: true,
                    render: (item) => item.category,
                  },
                  {
                    key: 'evidence',
                    label: '来源链接数',
                    numeric: true,
                    secondary: true,
                    render: (item: WordCandidateListItem) =>
                      item.evidenceCount === null ? '—' : item.evidenceCount,
                  },
                  {
                    key: 'created',
                    label: '入队时间',
                    secondary: true,
                    render: (item) => <DateLabel value={item.createdAt} />,
                  },
                  ...(isPending
                    ? [
                        {
                          key: 'actions',
                          label: '操作',
                          render: (item: WordCandidateListItem) => (
                            <span className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-text-button"
                                disabled={busy}
                                onClick={() => confirmApprove([item.id])}
                              >
                                批准
                              </button>
                              <button
                                type="button"
                                className="admin-text-button admin-danger-text"
                                disabled={busy}
                                onClick={() => confirmDismiss([item.id])}
                              >
                                拒绝
                              </button>
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              <CursorPager
                page={cursors.length}
                hasNext={data.nextCursor !== null}
                onPrevious={() => setCursors((current) => current.slice(0, -1))}
                onNext={() => {
                  if (data.nextCursor !== null)
                    setCursors((current) => [...current, data.nextCursor]);
                }}
              />
              {isPending && (
                <div className="admin-bulk-bar">
                  <label className="admin-submission-check">
                    <input
                      type="checkbox"
                      aria-label="全选当前结果"
                      checked={selectedIds.length > 0 && selectedIds.length === items.length}
                      onChange={(event) => {
                        if (event.target.checked)
                          setSelected(new Set(items.map((item) => item.id)));
                        else setSelected(new Set());
                      }}
                    />
                    已选 {selectedIds.length} / {items.length}
                  </label>
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={selectedIds.length === 0 || busy}
                    onClick={() => confirmApprove(selectedIds)}
                  >
                    批准 {selectedIds.length}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-solid"
                    disabled={selectedIds.length === 0 || busy}
                    onClick={() => confirmDismiss(selectedIds)}
                  >
                    拒绝 {selectedIds.length}
                  </button>
                </div>
              )}
            </>
          );
        }}
      </AsyncBoundary>
    </Panel>
  );
}

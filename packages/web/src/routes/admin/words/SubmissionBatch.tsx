/** Batch curation keeps selection and all primary actions above the candidate list. */
import {
  type GameWordGame,
  type WordSubmissionBatch,
  type WordSubmissionItem,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';

import { AsyncBoundary, DataTable, PageHeading } from '../components/Primitives';
import { SubmissionActionDialog, type SubmissionConfirmation } from './SubmissionActionDialog';
import { SubmissionItemDrawer } from './SubmissionItemDrawer';
import { useSubmissionCommand } from './useSubmissionCommand';
import {
  isApprovableSubmission,
  isSelectableSubmission,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
  WordSections,
} from './WordSections';

/** Review jobs run durably in the background; the shared refresh button updates their snapshots. */
export function SubmissionBatchPage({ game, batchId }: { game: GameWordGame; batchId: string }) {
  const query = useQuery(
    adminQueryOptions('word-submissions', { kind: 'batch', batch: batchId }, (signal) =>
      wordSubmissionsApi.batch(batchId, signal),
    ),
  );
  return (
    <>
      <PageHeading
        title="词库"
        description="独立审核或人工通过后，再明确确认发布。"
        query={query}
        controls={<WordSections game={game} section="submissions" />}
        action={
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
            刷新审核进度
          </button>
        }
      />
      <div className="admin-content admin-submission-content">
        <Link to={`/admin/words/${game}?section=submissions`} replace>
          返回外部投稿
        </Link>
        <AsyncBoundary query={query}>
          {(batch) => <BatchCandidates batch={batch} onRefresh={() => void query.refetch()} />}
        </AsyncBoundary>
      </div>
    </>
  );
}

function BatchCandidates({
  batch,
  onRefresh,
}: {
  batch: WordSubmissionBatch;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<SubmissionConfirmation | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const visible = batch.items.filter((item) => filter === 'all' || item.status === filter);
  const selectedItems = batch.items.filter(
    (item) => selected.has(item.id) && isSelectableSubmission(item),
  );
  const awaiting = batch.items.filter((item) => ['pending', 'failed'].includes(item.status));
  const activeItem = batch.items.find((item) => item.id === active);
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      else heading.current?.focus({ preventScroll: true });
    });
  }
  function close() {
    setConfirmation(null);
    setActive(null);
    restoreFocus();
  }
  function openAction(value: SubmissionConfirmation) {
    setActive(null);
    setConfirmation(value);
  }
  return (
    <>
      <div className="admin-submission-batch-heading">
        <div>
          <h2 tabIndex={-1} ref={heading}>
            {WORD_GAME_LABELS[batch.game]} · {batch.agentName}
          </h2>
          <p className="admin-submission-id">{batch.id}</p>
          <p className="admin-submission-note">
            {batch.items.length} 个候选 · {new Date(batch.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
        {awaiting.length > 0 && (
          <div className="admin-submission-actions">
            <button
              type="button"
              className="admin-primary"
              onClick={(event) => {
                opener.current = event.currentTarget;
                openAction({ action: 'review', items: awaiting });
              }}
            >
              审核全部待审 ({awaiting.length})
            </button>
          </div>
        )}
      </div>
      <p className="admin-submission-note">
        审核不自动发布；“全部待审”包含待启动和审核失败项。管理员审核不受应用额度限制，调用仍记账，可能产生费用。
        也可核对材料后人工通过，再单独发布。
      </p>
      <ReviewDispatchNotice batch={batch} onRefresh={onRefresh} />
      <section className="admin-panel" aria-label="批次候选">
        <div className="admin-submission-candidate-controls">
          <div className="admin-panel-heading">
            <h3>候选明细</h3>
            <CandidateFilters
              items={batch.items}
              filter={filter}
              onChange={(status) => {
                setFilter(status);
                setSelected(new Set());
              }}
            />
          </div>
          <SelectionToolbar
            visible={visible}
            selected={selected}
            selectedItems={selectedItems}
            onSelect={setSelected}
            onAction={(value, button) => {
              opener.current = button;
              openAction(value);
            }}
          />
        </div>
        <CandidateTable
          items={visible}
          selected={selected}
          onSelect={setSelected}
          onOpen={(item, button) => {
            opener.current = button;
            setActive(item.id);
          }}
        />
        {visible.length === 0 && <p className="admin-submission-empty">当前状态没有候选。</p>}
      </section>
      {activeItem !== undefined && (
        <SubmissionItemDrawer
          batch={batch}
          item={activeItem}
          onClose={close}
          onAction={openAction}
        />
      )}
      {confirmation !== null && (
        <SubmissionActionDialog
          batchId={batch.id}
          confirmation={confirmation}
          onClose={close}
          onComplete={() => {
            setSelected(new Set());
            close();
          }}
        />
      )}
    </>
  );
}

function ReviewDispatchNotice({
  batch,
  onRefresh,
}: {
  batch: WordSubmissionBatch;
  onRefresh: () => void;
}) {
  const dispatch = useSubmissionCommand(async (ids: string[]) => {
    for (const id of ids) await wordSubmissionsApi.dispatch(batch.id, id);
    onRefresh();
  });
  const runningIds = [
    ...new Set(
      batch.items
        .filter((item) => item.status === 'reviewing')
        .flatMap((item) => (item.reviewId === null ? [] : [item.reviewId])),
    ),
  ];
  return (
    <>
      {runningIds.length > 0 && (
        <div className="admin-notice admin-submission-actions">
          <span>
            审核正在后台运行。请刷新进度；启动请求未确认时，可重新确认同一任务，不会产生第二次审核。
          </span>
          <button
            type="button"
            disabled={dispatch.isPending}
            onClick={() => dispatch.mutate(runningIds)}
          >
            确认审核任务启动
          </button>
        </div>
      )}
      {dispatch.error !== null && (
        <p role="alert" className="admin-error-box">
          {dispatch.error.message}
        </p>
      )}
    </>
  );
}

function CandidateFilters({
  items,
  filter,
  onChange,
}: {
  items: WordSubmissionItem[];
  filter: string;
  onChange: (status: string) => void;
}) {
  const options = [
    { value: 'all', label: '全部', count: items.length },
    ...wordSubmissionStatusSchema.options.flatMap((status) => {
      const count = items.filter((item) => item.status === status).length;
      return count === 0 ? [] : [{ value: status, label: SUBMISSION_STATUS_LABELS[status], count }];
    }),
  ];
  return (
    <div
      className="admin-segmented admin-submission-status-tabs"
      role="group"
      aria-label="筛选候选状态"
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={filter === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label} {option.count}
        </button>
      ))}
    </div>
  );
}

function CandidateTable({
  items,
  selected,
  onSelect,
  onOpen,
}: {
  items: WordSubmissionItem[];
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (item: WordSubmissionItem, button: HTMLButtonElement) => void;
}) {
  return (
    <DataTable
      caption="投稿候选明细"
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
                disabled={!isSelectableSubmission(item)}
                checked={isSelectableSubmission(item) && selected.has(item.id)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(item.id);
                  else next.delete(item.id);
                  onSelect(next);
                }}
              />
            </label>
          ),
        },
        {
          key: 'title',
          label: '词条',
          render: (item) => (
            <button
              type="button"
              className="admin-text-button"
              aria-label={`查看${item.title}审核详情`}
              onClick={(event) => onOpen(item, event.currentTarget)}
            >
              {item.title}
            </button>
          ),
        },
        { key: 'category', label: '分类', secondary: true, render: (item) => item.category },
        {
          key: 'status',
          label: '审核状态',
          render: (item) => <SubmissionStatus status={item.status} />,
        },
        {
          key: 'reason',
          label: '审核摘要',
          secondary: true,
          render: (item) =>
            item.approvalReason !== null
              ? '人工通过；原审核记录保留'
              : (item.review?.reason ?? item.failure ?? '尚无审核结论'),
        },
      ]}
    />
  );
}

function SelectionToolbar({
  visible,
  selected,
  selectedItems,
  onSelect,
  onAction,
}: {
  visible: WordSubmissionItem[];
  selected: Set<string>;
  selectedItems: WordSubmissionItem[];
  onSelect: (ids: Set<string>) => void;
  onAction: (confirmation: SubmissionConfirmation, button: HTMLButtonElement) => void;
}) {
  const all = useRef<HTMLInputElement>(null);
  const eligible = visible.filter(isSelectableSubmission);
  const selectedVisible = eligible.filter((item) => selected.has(item.id)).length;
  useEffect(() => {
    if (all.current !== null)
      all.current.indeterminate = selectedVisible > 0 && selectedVisible < eligible.length;
  }, [selectedVisible, eligible.length]);
  const reviewable = selectedItems.filter((item) => ['pending', 'failed'].includes(item.status));
  const approvable = selectedItems.filter(isApprovableSubmission);
  const publishable = selectedItems.filter((item) => item.status === 'passed');
  return (
    <div className="admin-submission-selection" aria-label="候选批量操作">
      <div className="admin-submission-actions">
        <label className="admin-submission-check">
          <input
            ref={all}
            type="checkbox"
            aria-label="全选当前结果"
            disabled={eligible.length === 0}
            checked={eligible.length > 0 && selectedVisible === eligible.length}
            onChange={(event) => {
              const next = new Set(selected);
              for (const item of eligible) {
                if (event.target.checked) next.add(item.id);
                else next.delete(item.id);
              }
              onSelect(next);
            }}
          />
          全选当前结果
        </label>
        <span role="status">
          已选 {selectedItems.length} / 当前可选 {eligible.length}
        </span>
        {selectedItems.length > 0 && (
          <button type="button" className="admin-text-button" onClick={() => onSelect(new Set())}>
            取消选择
          </button>
        )}
      </div>
      {selectedItems.length === 0 ? (
        <p className="admin-muted">
          先勾选，再独立审核、人工通过、发布或拒绝。已发布、审核中和已处理项不可选。
        </p>
      ) : (
        <div className="admin-submission-actions">
          {reviewable.length > 0 && (
            <button
              type="button"
              onClick={(event) =>
                onAction({ action: 'review', items: reviewable }, event.currentTarget)
              }
            >
              审核所选 ({reviewable.length})
            </button>
          )}
          {approvable.length > 0 && (
            <button
              type="button"
              onClick={(event) =>
                onAction({ action: 'approve', items: approvable }, event.currentTarget)
              }
            >
              人工通过所选 ({approvable.length})
            </button>
          )}
          {publishable.length > 0 && (
            <button
              type="button"
              className="admin-primary"
              onClick={(event) =>
                onAction({ action: 'publish', items: publishable }, event.currentTarget)
              }
            >
              发布所选 ({publishable.length})
            </button>
          )}
          <button
            type="button"
            className="admin-error"
            onClick={(event) =>
              onAction({ action: 'dismiss', items: selectedItems }, event.currentTarget)
            }
          >
            拒绝所选 ({selectedItems.length})
          </button>
        </div>
      )}
    </div>
  );
}

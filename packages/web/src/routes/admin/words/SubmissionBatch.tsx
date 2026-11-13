/** Batch curation keeps status filters and selection controls in reach while candidates scroll. */
import {
  type WordSubmissionBatch,
  type WordSubmissionItem,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import IconRefreshOutline from '~icons/ion/refresh-outline';

import { DetailDrawer } from '../components/Overlays';
import { AsyncBoundary, DataTable } from '../components/Primitives';
import { SubmissionActionDialog, type SubmissionConfirmation } from './SubmissionActionDialog';
import { SubmissionItemDrawer } from './SubmissionItemDrawer';
import { useSubmissionCommand } from './useSubmissionCommand';
import {
  isSelectableSubmission,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
  WordChoiceFilter,
} from './WordSections';

/** Review jobs run durably in the background; the shared refresh button updates their snapshots. */
export function SubmissionBatchPage({
  batchId,
  onClose,
}: {
  batchId: string;
  onClose: () => void;
}) {
  const query = useQuery(
    adminQueryOptions('word-submissions', { kind: 'batch', batch: batchId }, (signal) =>
      wordSubmissionsApi.batch(batchId, signal),
    ),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<SubmissionConfirmation | null>(null);
  const reviewAllButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const actionOpener = useRef<HTMLButtonElement | null>(null);
  const batch = query.data;
  const awaiting = batch?.items.filter((item) => ['pending', 'failed'].includes(item.status)) ?? [];
  const selectedItems =
    batch?.items.filter((item) => selected.has(item.id) && isSelectableSubmission(item)) ?? [];
  const reviewable = selectedItems.filter((item) => ['pending', 'failed'].includes(item.status));
  const publishable = selectedItems.filter((item) => item.status === 'passed');
  function openAction(value: SubmissionConfirmation, button?: HTMLButtonElement) {
    actionOpener.current = button ?? null;
    setConfirmation(value);
  }
  function closeAction() {
    setConfirmation(null);
    requestAnimationFrame(() => {
      const target = actionOpener.current ?? refreshButton.current ?? reviewAllButton.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }
  return (
    <>
      <DetailDrawer
        variant="workspace"
        title="投稿批次审核"
        onClose={onClose}
        footer={
          selectedItems.length > 0 ? (
            <div className="admin-submission-footer-actions" role="group" aria-label="候选批量操作">
              <button
                ref={refreshButton}
                type="button"
                className="admin-icon-button"
                aria-label="刷新审核进度"
                title="刷新审核进度"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <IconRefreshOutline aria-hidden />
              </button>
              {reviewable.length > 0 && (
                <button
                  type="button"
                  onClick={(event) =>
                    openAction({ action: 'review', items: reviewable }, event.currentTarget)
                  }
                >
                  审核 {reviewable.length}
                </button>
              )}
              {publishable.length > 0 && (
                <button
                  type="button"
                  className="admin-primary"
                  onClick={(event) =>
                    openAction({ action: 'publish', items: publishable }, event.currentTarget)
                  }
                >
                  发布 {publishable.length}
                </button>
              )}
              <button
                type="button"
                className="admin-error"
                onClick={(event) =>
                  openAction({ action: 'dismiss', items: selectedItems }, event.currentTarget)
                }
              >
                拒绝 {selectedItems.length}
              </button>
            </div>
          ) : (
            <>
              <button
                ref={refreshButton}
                type="button"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {query.isFetching ? '正在刷新…' : '刷新审核进度'}
              </button>
              {awaiting.length > 0 && (
                <button
                  ref={reviewAllButton}
                  type="button"
                  className="admin-primary"
                  onClick={(event) =>
                    openAction({ action: 'review', items: awaiting }, event.currentTarget)
                  }
                >
                  审核全部待审 ({awaiting.length})
                </button>
              )}
            </>
          )
        }
      >
        <div className="admin-submission-workspace">
          <AsyncBoundary query={query}>
            {(loadedBatch) => (
              <BatchCandidates
                batch={loadedBatch}
                selected={selected}
                onSelect={setSelected}
                onAction={openAction}
                onRefresh={() => void query.refetch()}
              />
            )}
          </AsyncBoundary>
        </div>
      </DetailDrawer>
      {confirmation !== null && batch !== undefined && (
        <SubmissionActionDialog
          batchId={batch.id}
          confirmation={confirmation}
          onClose={closeAction}
          onComplete={() => {
            setSelected(new Set());
            closeAction();
            void query.refetch();
          }}
        />
      )}
    </>
  );
}

function BatchCandidates({
  batch,
  selected,
  onSelect,
  onAction,
  onRefresh,
}: {
  batch: WordSubmissionBatch;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onAction: (confirmation: SubmissionConfirmation) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const visible = batch.items.filter((item) => filter === 'all' || item.status === filter);
  const selectedItems = batch.items.filter(
    (item) => selected.has(item.id) && isSelectableSubmission(item),
  );
  const activeItem = batch.items.find((item) => item.id === active);
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      else heading.current?.focus({ preventScroll: true });
    });
  }
  function close() {
    setActive(null);
    restoreFocus();
  }
  function openAction(value: SubmissionConfirmation) {
    setActive(null);
    onAction(value);
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
      </div>
      <p className="admin-submission-note">
        审核不自动发布；“全部待审”包含待启动和审核失败项。管理员审核不受应用额度限制，调用仍记账，可能产生费用。
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
                onSelect(new Set());
              }}
            />
          </div>
          <SelectionToolbar
            visible={visible}
            selected={selected}
            selectedItems={selectedItems}
            onSelect={onSelect}
          />
        </div>
        <CandidateTable
          items={visible}
          selected={selected}
          onSelect={onSelect}
          onOpen={(item, element) => {
            opener.current = element;
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
    { value: 'all', label: `全部 (${items.length})` },
    ...wordSubmissionStatusSchema.options.flatMap((status) => {
      const count = items.filter((item) => item.status === status).length;
      return count === 0
        ? []
        : [{ value: status, label: `${SUBMISSION_STATUS_LABELS[status]} (${count})` }];
    }),
  ];
  return (
    <div className="admin-submission-status-filter">
      <WordChoiceFilter label="候选状态" value={filter} options={options} onChange={onChange} />
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
  onOpen: (item: WordSubmissionItem, element: HTMLElement) => void;
}) {
  return (
    <DataTable
      caption="投稿候选明细"
      rows={items}
      rowKey={(item) => item.id}
      rowLabel={(item) => `查看词条详情：${item.title}`}
      onRowClick={onOpen}
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
          render: (item) => item.review?.reason ?? item.failure ?? '尚无审核结论',
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
}: {
  visible: WordSubmissionItem[];
  selected: Set<string>;
  selectedItems: WordSubmissionItem[];
  onSelect: (ids: Set<string>) => void;
}) {
  const all = useRef<HTMLInputElement>(null);
  const eligible = visible.filter(isSelectableSubmission);
  const selectedVisible = eligible.filter((item) => selected.has(item.id)).length;
  useEffect(() => {
    if (all.current !== null)
      all.current.indeterminate = selectedVisible > 0 && selectedVisible < eligible.length;
  }, [selectedVisible, eligible.length]);
  return (
    <div className="admin-submission-selection" role="group" aria-label="候选选择">
      <div className="admin-submission-selection-row">
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
        <div className="admin-submission-selection-summary">
          <span role="status">
            已选 {selectedItems.length} / 当前可选 {eligible.length}
          </span>
          {selectedItems.length > 0 && (
            <button type="button" className="admin-text-button" onClick={() => onSelect(new Set())}>
              清除
            </button>
          )}
        </div>
      </div>
      {selectedItems.length === 0 && (
        <p className="admin-muted">已发布、审核中和已处理的候选不可选。</p>
      )}
    </div>
  );
}

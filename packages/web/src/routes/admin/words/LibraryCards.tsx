/** The merged card stream: one FIFO list of supply candidates and submission
 * items. Card actions dispatch by row source (D-R3); review and publish live
 * only in the batch detail. Inventory never enters the stream. */
import { useState } from 'react';

import type {
  GameWordGame,
  PublishWordCandidatesResult,
  ReviewWordCandidatesResult,
  WordCandidateListStatus,
  WordLibraryItem,
  WordLibraryItems,
  WordSubmissionStatus,
} from '@/features/admin/model/adminContracts';
import {
  approveWordCandidates,
  dismissWordCandidates,
  publishWordCandidates,
  reviewWordCandidates,
} from '@/features/admin/services/adminApi';
import { showAlert, showPrompt } from '@/utils/alert';
import { log } from '@/utils/logger';

import { CursorPager, DateLabel, StatusBadge } from '../components/Primitives';
import { SubmissionActionDialog, type SubmissionConfirmation } from './SubmissionActionDialog';
import { useSubmissionCommand } from './useSubmissionCommand';
import { CANDIDATE_STATUS_LABELS, SubmissionStatus, WORD_GAME_LABELS } from './wordLabels';

const CANDIDATE_STATUSES: readonly string[] = [
  'pending',
  'approved',
  'claimed',
  'reviewing',
  'passed',
  'accepted',
  'rejected',
  'failed',
  'published',
];
const SUBMISSION_STATUSES: readonly string[] = [
  'pending',
  'approved',
  'reviewing',
  'passed',
  'rejected',
  'failed',
  'published',
  'dismissed',
  'unpublished',
  'duplicate',
];

function isCandidateStatus(value: string): value is WordCandidateListStatus {
  return CANDIDATE_STATUSES.includes(value);
}

function isSubmissionStatus(value: string): value is WordSubmissionStatus {
  return SUBMISSION_STATUSES.includes(value);
}

const candidateLog = log.extend('AdminWordCandidates');
const libraryLog = log.extend('AdminWordLibrary');

export type LibrarySourceFilter = 'all' | 'inventory' | 'submissions';

function isApprovableCandidate(item: WordLibraryItem): boolean {
  return item.source === 'candidate' && item.status === 'pending';
}

/** A candidate takes the manual review road from approved, from failed
 * (retry), or from passed (re-review, e.g. after a review-version change). */
function isReviewableCandidate(item: WordLibraryItem): boolean {
  return (
    item.source === 'candidate' &&
    (item.status === 'approved' || item.status === 'failed' || item.status === 'passed')
  );
}

function isPublishableCandidate(item: WordLibraryItem): boolean {
  return item.source === 'candidate' && item.status === 'passed';
}

function isEndorsableSubmission(item: WordLibraryItem): boolean {
  return item.source === 'submission' && item.status === 'pending';
}

function isUnendorsableSubmission(item: WordLibraryItem): boolean {
  return item.source === 'submission' && item.status === 'approved';
}

function isDismissableSubmission(item: WordLibraryItem): boolean {
  return item.source === 'submission' && (item.status === 'pending' || item.status === 'approved');
}

/** A row takes part in bulk actions only when at least one bulk verb applies to it. */
function isBulkActionable(item: WordLibraryItem): boolean {
  return (
    isApprovableCandidate(item) ||
    isReviewableCandidate(item) ||
    isPublishableCandidate(item) ||
    isEndorsableSubmission(item) ||
    isUnendorsableSubmission(item) ||
    isDismissableSubmission(item)
  );
}

function toConfirmationItem(item: WordLibraryItem): SubmissionConfirmation['items'][number] {
  if (item.batchId === null || item.contentHash === null || item.revision === null)
    throw new Error('Submission row is missing its action payload');
  return {
    id: item.id,
    title: item.title,
    contentHash: item.contentHash,
    revision: item.revision,
  };
}

function CandidateStatus({ status }: { status: WordCandidateListStatus }) {
  const tone =
    status === 'accepted' || status === 'passed' || status === 'published'
      ? 'success'
      : status === 'rejected' || status === 'failed'
        ? 'danger'
        : status === 'claimed'
          ? 'neutral'
          : 'warning';
  return <StatusBadge tone={tone}>{CANDIDATE_STATUS_LABELS[status]}</StatusBadge>;
}

function LibraryStatusPill({ item }: { item: WordLibraryItem }) {
  if (item.source === 'candidate' && isCandidateStatus(item.status))
    return <CandidateStatus status={item.status} />;
  if (item.source === 'submission' && isSubmissionStatus(item.status))
    return <SubmissionStatus status={item.status} />;
  return null;
}

/** The card stream owns selection, notices, and the per-batch action dialogs.
 * Paging state lives in the page (it owns the query); scope changes remount
 * this component via key, which clears selection, notices, and dialogs. */
export function LibraryCards({
  game,
  source,
  status,
  search,
  data,
  page,
  onPrevious,
  onNext,
  onOpenBatch,
}: {
  game: GameWordGame;
  source: LibrarySourceFilter;
  status: string;
  search: string;
  data: WordLibraryItems;
  page: number;
  onPrevious: () => void;
  onNext: () => void;
  onOpenBatch: (batchId: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [dialogQueue, setDialogQueue] = useState<
    readonly { batchId: string; confirmation: SubmissionConfirmation }[]
  >([]);
  const items = data.items;
  const selectedItems = items.filter((item) => selected.has(item.key));
  const approve = useSubmissionCommand(
    async (input: { candidateIds: string[]; reason: string }) => {
      const result = await approveWordCandidates(game, input.candidateIds, input.reason);
      setSelected((current) => {
        const next = new Set(current);
        for (const id of input.candidateIds) next.delete(`candidate:${id}`);
        return next;
      });
      setNotice(
        result.skippedIds.length === 0
          ? `已批准 ${result.approvedIds.length} 条，请手动启动独立审核。`
          : `已批准 ${result.approvedIds.length} 条，${result.skippedIds.length} 条已不在待批准队列。请手动启动独立审核。`,
      );
      candidateLog.info('candidates approved', { game, approved: result.approvedIds.length });
    },
    '候选批准',
  );
  const dismiss = useSubmissionCommand(
    async (input: { candidateIds: string[]; reason: string }) => {
      const result = await dismissWordCandidates(game, input.candidateIds, input.reason);
      setSelected((current) => {
        const next = new Set(current);
        for (const id of input.candidateIds) next.delete(`candidate:${id}`);
        return next;
      });
      setNotice(
        result.skippedIds.length === 0
          ? `已拒绝 ${result.dismissedIds.length} 条。`
          : `已拒绝 ${result.dismissedIds.length} 条，${result.skippedIds.length} 条已不在待批准队列。`,
      );
      candidateLog.info('candidates dismissed', { game, dismissed: result.dismissedIds.length });
    },
    '候选拒绝',
  );
  /** Manual independent review: the endpoint takes at most five candidates
   * per call, so a larger selection is sent in groups of five, in order,
   * and the outcomes are summed. */
  const review = useSubmissionCommand(async (input: { candidateIds: string[] }) => {
    const totals: ReviewWordCandidatesResult = {
      game,
      passedIds: [],
      rejectedIds: [],
      failedIds: [],
      skippedIds: [],
    };
    for (let offset = 0; offset < input.candidateIds.length; offset += 5) {
      const group = input.candidateIds.slice(offset, offset + 5);
      const result = await reviewWordCandidates(game, group);
      totals.passedIds.push(...result.passedIds);
      totals.rejectedIds.push(...result.rejectedIds);
      totals.failedIds.push(...result.failedIds);
      totals.skippedIds.push(...result.skippedIds);
    }
    setSelected((current) => {
      const next = new Set(current);
      for (const id of input.candidateIds) next.delete(`candidate:${id}`);
      return next;
    });
    setNotice(
      `独立审核完成：通过 ${totals.passedIds.length} 条，未通过 ${totals.rejectedIds.length} 条，失败 ${totals.failedIds.length} 条` +
        (totals.skippedIds.length === 0
          ? '。'
          : `，${totals.skippedIds.length} 条已不在待审核队列。`),
    );
    candidateLog.info('candidates reviewed', {
      game,
      passed: totals.passedIds.length,
      rejected: totals.rejectedIds.length,
      failed: totals.failedIds.length,
    });
  }, '词语候选操作');
  const publish = useSubmissionCommand(async (input: { candidateIds: string[] }) => {
    const result: PublishWordCandidatesResult = await publishWordCandidates(
      game,
      input.candidateIds,
    );
    setSelected((current) => {
      const next = new Set(current);
      for (const id of input.candidateIds) next.delete(`candidate:${id}`);
      return next;
    });
    setNotice(
      `已发布 ${result.publishedIds.length} 条` +
        (result.rejectedIds.length === 0 ? '' : `，${result.rejectedIds.length} 条未通过发布门`) +
        (result.skippedIds.length === 0
          ? '。'
          : `，${result.skippedIds.length} 条已不在待发布队列。`),
    );
    candidateLog.info('candidates published', { game, published: result.publishedIds.length });
  }, '词语候选操作');
  const busy = approve.isPending || dismiss.isPending || review.isPending || publish.isPending;

  function confirmApproveCandidate(candidateIds: string[]) {
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
  function confirmDismissCandidate(candidateIds: string[]) {
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
  function queueSubmissionAction(
    action: SubmissionConfirmation['action'],
    rows: readonly WordLibraryItem[],
  ) {
    const groups = new Map<string, WordLibraryItem[]>();
    for (const item of rows) {
      if (item.batchId === null) continue;
      const group = groups.get(item.batchId) ?? [];
      group.push(item);
      groups.set(item.batchId, group);
    }
    setDialogQueue((current) => [
      ...current,
      ...[...groups.entries()].map(([batchId, group]) => ({
        batchId,
        confirmation: { action, items: group.map(toConfirmationItem) },
      })),
    ]);
  }
  function bulkApprove() {
    const candidates = selectedItems.filter(isApprovableCandidate);
    const submissions = selectedItems.filter(isEndorsableSubmission);
    confirmApproveCandidate(candidates.map((item) => item.id));
    queueSubmissionAction('endorse', submissions);
  }
  function bulkDismiss() {
    const candidates = selectedItems.filter(isApprovableCandidate);
    const submissions = selectedItems.filter(isDismissableSubmission);
    confirmDismissCandidate(candidates.map((item) => item.id));
    queueSubmissionAction('dismiss', submissions);
  }
  function bulkUnendorse() {
    queueSubmissionAction('unendorse', selectedItems.filter(isUnendorsableSubmission));
  }
  function bulkReview() {
    const ids = selectedItems.filter(isReviewableCandidate).map((item) => item.id);
    if (ids.length === 0) return;
    review.mutate({ candidateIds: ids });
  }
  function bulkPublish() {
    const ids = selectedItems.filter(isPublishableCandidate).map((item) => item.id);
    if (ids.length === 0) return;
    publish.mutate({ candidateIds: ids });
  }
  function completeDialog(action: SubmissionConfirmation['action'], count: number) {
    const done = dialogQueue[0];
    setDialogQueue((current) => current.slice(1));
    if (done !== undefined) {
      const doneIds = new Set(done.confirmation.items.map((entry) => `submission:${entry.id}`));
      setSelected((current) => {
        const next = new Set(current);
        for (const key of doneIds) next.delete(key);
        return next;
      });
    }
    setNotice(
      action === 'endorse'
        ? `已批准进入审核 ${count} 条。`
        : action === 'unendorse'
          ? `已撤回批准 ${count} 条。`
          : `已拒绝 ${count} 条。`,
    );
    libraryLog.info('library submission action complete', { action, count });
  }
  // The notice outlives the stream: after the last row is actioned, the
  // refetch returns an empty list, and the empty branch below must still
  // show what just happened.
  const noticeElement =
    notice === '' ? null : (
      <p role="status" className="admin-notice">
        {notice}
      </p>
    );
  if (source === 'inventory') {
    return (
      <>
        {noticeElement}
        <p className="admin-muted">
          库存词只在统计与来源行里显示，不进入这条待处理流。这条流只列还没进库的候选与投稿。
        </p>
      </>
    );
  }
  if (items.length === 0) {
    return (
      <>
        {noticeElement}
        <p className="admin-muted">
          {search !== '' || status !== '' || source !== 'all'
            ? '没有匹配的词条，试试其他筛选条件。'
            : '暂无待处理词条。'}
        </p>
      </>
    );
  }
  const approvable = selectedItems.filter(
    (item) => isApprovableCandidate(item) || isEndorsableSubmission(item),
  );
  const dismissable = selectedItems.filter(
    (item) => isApprovableCandidate(item) || isDismissableSubmission(item),
  );
  const unendorsable = selectedItems.filter(isUnendorsableSubmission);
  const reviewable = selectedItems.filter(isReviewableCandidate);
  const publishable = selectedItems.filter(isPublishableCandidate);
  const actionableItems = items.filter(isBulkActionable);
  const activeDialog = dialogQueue[0];
  return (
    <>
      {noticeElement}
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
      {review.isError && (
        <p role="alert" className="admin-error-box">
          独立审核失败，请稍后重试。
        </p>
      )}
      {publish.isError && (
        <p role="alert" className="admin-error-box">
          确认发布失败，请稍后重试。
        </p>
      )}
      <div className="admin-library-cards" role="list" aria-label="待处理词条">
        {items.map((item) => (
          <LibraryCard
            key={item.key}
            item={item}
            game={game}
            selected={selected.has(item.key)}
            disabled={busy}
            onSelect={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(item.key);
              else next.delete(item.key);
              setSelected(next);
            }}
            onApproveCandidate={() => confirmApproveCandidate([item.id])}
            onDismissCandidate={() => confirmDismissCandidate([item.id])}
            onReviewCandidate={() => review.mutate({ candidateIds: [item.id] })}
            onPublishCandidate={() => publish.mutate({ candidateIds: [item.id] })}
            onSubmissionAction={(action) => queueSubmissionAction(action, [item])}
            onOpenBatch={() => {
              if (item.batchId === null) throw new Error('Submission row is missing its batch');
              onOpenBatch(item.batchId);
            }}
          />
        ))}
      </div>
      <CursorPager
        page={page}
        hasNext={data.nextCursor !== null}
        onPrevious={onPrevious}
        onNext={onNext}
      />
      {selectedItems.length > 0 && (
        <div className="admin-bulk-bar">
          <label className="admin-submission-check">
            <input
              type="checkbox"
              aria-label="全选当前结果"
              checked={
                actionableItems.length > 0 &&
                actionableItems.every((item) => selected.has(item.key))
              }
              onChange={(event) => {
                if (event.target.checked)
                  setSelected(new Set(actionableItems.map((item) => item.key)));
                else setSelected(new Set());
              }}
            />
            已选 {selectedItems.length} / 当前可选 {actionableItems.length}
          </label>
          <button
            type="button"
            className="admin-primary"
            disabled={approvable.length === 0 || busy}
            onClick={bulkApprove}
          >
            批量批准 {approvable.length}
          </button>
          <button
            type="button"
            className="admin-danger-solid"
            disabled={dismissable.length === 0 || busy}
            onClick={bulkDismiss}
          >
            批量拒绝 {dismissable.length}
          </button>
          <button
            type="button"
            disabled={unendorsable.length === 0 || busy}
            onClick={bulkUnendorse}
          >
            批量撤回批准 {unendorsable.length}
          </button>
          <button
            type="button"
            className="admin-primary"
            disabled={reviewable.length === 0 || busy}
            onClick={bulkReview}
          >
            批量审核 {reviewable.length}
          </button>
          <button
            type="button"
            className="admin-primary"
            disabled={publishable.length === 0 || busy}
            onClick={bulkPublish}
          >
            批量发布 {publishable.length}
          </button>
          {approvable.length === 0 &&
            dismissable.length === 0 &&
            unendorsable.length === 0 &&
            reviewable.length === 0 &&
            publishable.length === 0 && (
              <span className="admin-muted">所选行都已处理完毕，没有可批量操作的内容。</span>
            )}
        </div>
      )}
      {activeDialog !== undefined && (
        <SubmissionActionDialog
          key={activeDialog.batchId}
          batchId={activeDialog.batchId}
          confirmation={activeDialog.confirmation}
          onClose={() => setDialogQueue((current) => current.slice(1))}
          onComplete={() =>
            completeDialog(activeDialog.confirmation.action, activeDialog.confirmation.items.length)
          }
        />
      )}
    </>
  );
}

function LibraryCard({
  item,
  game,
  selected,
  disabled,
  onSelect,
  onApproveCandidate,
  onDismissCandidate,
  onReviewCandidate,
  onPublishCandidate,
  onSubmissionAction,
  onOpenBatch,
}: {
  item: WordLibraryItem;
  game: GameWordGame;
  selected: boolean;
  disabled: boolean;
  onSelect: (checked: boolean) => void;
  onApproveCandidate: () => void;
  onDismissCandidate: () => void;
  onReviewCandidate: () => void;
  onPublishCandidate: () => void;
  onSubmissionAction: (action: SubmissionConfirmation['action']) => void;
  onOpenBatch: () => void;
}) {
  const actionable = isBulkActionable(item);
  return (
    <article className="admin-library-card" role="listitem">
      <div className="admin-library-card-head">
        <label className="admin-submission-check">
          <input
            type="checkbox"
            aria-label={`选择${item.title}`}
            disabled={!actionable}
            checked={actionable && selected}
            onChange={(event) => onSelect(event.target.checked)}
          />
        </label>
        <div className="admin-library-card-title">
          <span className="admin-library-word">{item.title}</span>
          <StatusBadge>{item.source === 'submission' ? 'Agent投稿' : '后台生成'}</StatusBadge>
          <LibraryStatusPill item={item} />
          <p className="admin-library-meta">
            {WORD_GAME_LABELS[game]} · {item.category} · 来源{' '}
            {item.source === 'submission' ? (item.agentName ?? 'Agent投稿') : '后台生成'} ·{' '}
            <DateLabel value={item.createdAt} />
          </p>
        </div>
      </div>
      {item.definition !== null && <p className="admin-library-definition">{item.definition}</p>}
      {item.duplicateOf !== null && item.duplicateOf.startsWith('inventory:') && (
        <p>
          <StatusBadge tone="danger" title="这个词已经在库里，发布时会被拦下">
            已有相同词在库
          </StatusBadge>
        </p>
      )}
      <div className="admin-row-actions">
        {item.source === 'submission' && (
          <button
            type="button"
            className="admin-text-button"
            aria-label={`查看投稿批次：${item.title}`}
            onClick={onOpenBatch}
          >
            查看投稿批次
          </button>
        )}
        {item.source === 'candidate' && item.status === 'pending' && (
          <>
            <button
              type="button"
              className="admin-text-button"
              disabled={disabled}
              onClick={onApproveCandidate}
            >
              批准
            </button>
            <button
              type="button"
              className="admin-text-button admin-danger-text"
              disabled={disabled}
              onClick={onDismissCandidate}
            >
              拒绝
            </button>
          </>
        )}
        {item.source === 'candidate' &&
          (item.status === 'approved' || item.status === 'failed' || item.status === 'passed') && (
            <button
              type="button"
              className="admin-text-button"
              disabled={disabled}
              onClick={onReviewCandidate}
            >
              启动独立审核
            </button>
          )}
        {item.source === 'candidate' && item.status === 'passed' && (
          <button
            type="button"
            className="admin-text-button"
            disabled={disabled}
            onClick={onPublishCandidate}
          >
            确认发布
          </button>
        )}
        {item.source === 'submission' && item.status === 'pending' && (
          <>
            <button
              type="button"
              className="admin-text-button"
              disabled={disabled}
              onClick={() => onSubmissionAction('endorse')}
            >
              批准
            </button>
            <button
              type="button"
              className="admin-text-button admin-danger-text"
              disabled={disabled}
              onClick={() => onSubmissionAction('dismiss')}
            >
              拒绝
            </button>
          </>
        )}
        {item.source === 'submission' && item.status === 'approved' && (
          <>
            <button
              type="button"
              className="admin-text-button"
              disabled={disabled}
              onClick={() => onSubmissionAction('unendorse')}
            >
              撤回批准
            </button>
            <button
              type="button"
              className="admin-text-button admin-danger-text"
              disabled={disabled}
              onClick={() => onSubmissionAction('dismiss')}
            >
              拒绝
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/** The submission card stream: one FIFO list of submission items, including
 * supply-produced ones (agent '系统补词'). Review and publish live in this
 * stream (bulk bar) and in the item drawer; there is no batch panel or batch
 * detail. Inventory never enters the stream. */
import { useEffect, useRef, useState } from 'react';

import type {
  GameWordGame,
  WordLibraryItem,
  WordLibraryItems,
} from '@/features/admin/model/adminContracts';
import { log } from '@/utils/logger';

import { CursorPager, DateLabel, StatusBadge } from '../components/Primitives';
import { SubmissionActionDialog, type SubmissionConfirmation } from './SubmissionActionDialog';
import { SubmissionItemDrawer } from './SubmissionItemDrawer';
import {
  isApprovableSubmission,
  isEndorsableSubmission,
  isSelectableSubmission,
  isUnendorsableSubmission,
  SubmissionStatus,
  SUPPLY_AGENT_NAME,
  WORD_GAME_LABELS,
} from './wordLabels';

const libraryLog = log.extend('AdminWordLibrary');

/** Review covers the batch detail's old `awaiting` set (approved/failed). */
function isReviewableSubmission(item: WordLibraryItem): boolean {
  return item.status === 'approved' || item.status === 'failed';
}

function isPublishableSubmission(item: WordLibraryItem): boolean {
  return item.status === 'passed';
}

/** A row takes part in bulk actions only when at least one bulk verb applies to it. */
function isBulkActionable(item: WordLibraryItem): boolean {
  return (
    isEndorsableSubmission(item) ||
    isUnendorsableSubmission(item) ||
    isSelectableSubmission(item) ||
    isReviewableSubmission(item) ||
    isPublishableSubmission(item) ||
    isApprovableSubmission(item)
  );
}

/** The action payload plus the batch it belongs to; the dialog is per batch. */
type ActionRow = Pick<WordLibraryItem, 'id' | 'title' | 'contentHash' | 'revision' | 'batchId'>;

function toConfirmationItem(item: ActionRow): SubmissionConfirmation['items'][number] {
  return {
    id: item.id,
    title: item.title,
    contentHash: item.contentHash,
    revision: item.revision,
  };
}

/** The card stream owns selection, notices, and the per-batch action dialogs.
 * Paging state lives in the page (it owns the query); scope changes remount
 * this component via key, which clears selection, notices, and dialogs. */
export function LibraryCards({
  game,
  status,
  search,
  data,
  page,
  onPrevious,
  onNext,
}: {
  game: GameWordGame;
  status: string;
  search: string;
  data: WordLibraryItems;
  page: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [drawerItem, setDrawerItem] = useState<WordLibraryItem | null>(null);
  const [dialogQueue, setDialogQueue] = useState<
    readonly { batchId: string; totalGroups: number; confirmation: SubmissionConfirmation }[]
  >([]);
  const allRef = useRef<HTMLInputElement>(null);
  const items = data.items;
  const selectedItems = items.filter((item) => selected.has(item.id));
  // The select-all checkbox is indeterminate while part of the page is
  // selected; the DOM property is not a React prop, so it is set here.
  const actionableCount = items.filter(isBulkActionable).length;
  useEffect(() => {
    if (allRef.current !== null)
      allRef.current.indeterminate =
        selectedItems.length > 0 && selectedItems.length < actionableCount;
  }, [selectedItems.length, actionableCount]);
  function queueSubmissionAction(
    action: SubmissionConfirmation['action'],
    rows: readonly ActionRow[],
  ) {
    const groups = new Map<string, ActionRow[]>();
    for (const item of rows) {
      const group = groups.get(item.batchId) ?? [];
      group.push(item);
      groups.set(item.batchId, group);
    }
    setDialogQueue((current) => [
      ...current,
      ...[...groups.entries()].map(([batchId, group]) => ({
        batchId,
        totalGroups: groups.size,
        confirmation: { action, items: group.map(toConfirmationItem) },
      })),
    ]);
  }
  function bulkApprove() {
    queueSubmissionAction('endorse', selectedItems.filter(isEndorsableSubmission));
  }
  function bulkDismiss() {
    queueSubmissionAction('dismiss', selectedItems.filter(isSelectableSubmission));
  }
  function bulkUnendorse() {
    queueSubmissionAction('unendorse', selectedItems.filter(isUnendorsableSubmission));
  }
  function bulkReview() {
    queueSubmissionAction('review', selectedItems.filter(isReviewableSubmission));
  }
  function bulkPublish() {
    queueSubmissionAction('publish', selectedItems.filter(isPublishableSubmission));
  }
  function bulkApproveHuman() {
    queueSubmissionAction('approve', selectedItems.filter(isApprovableSubmission));
  }
  function completeDialog(action: SubmissionConfirmation['action'], count: number) {
    const done = dialogQueue[0];
    setDialogQueue((current) => current.slice(1));
    if (done !== undefined) {
      const doneIds = new Set(done.confirmation.items.map((entry) => entry.id));
      setSelected((current) => {
        const next = new Set(current);
        for (const id of doneIds) next.delete(id);
        return next;
      });
    }
    setNotice(
      action === 'endorse'
        ? `已批准进入审核 ${count} 条。`
        : action === 'unendorse'
          ? `已撤回批准 ${count} 条。`
          : action === 'review'
            ? `已启动独立审核 ${count} 条。审核在后台运行，可在词条详情里确认启动。`
            : action === 'publish'
              ? `已确认发布 ${count} 条。`
              : action === 'approve'
                ? `已人工通过 ${count} 条。`
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
  if (items.length === 0) {
    return (
      <>
        {noticeElement}
        <p className="admin-muted">
          {page > 1
            ? '当前页已无词条，可以返回上一页。'
            : search !== '' || status !== ''
              ? '没有匹配的词条，试试其他筛选条件。'
              : '暂无待处理词条。'}
        </p>
        {page > 1 && (
          <CursorPager
            page={page}
            hasNext={data.nextCursor !== null}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        )}
      </>
    );
  }
  const approvable = selectedItems.filter(isEndorsableSubmission);
  const dismissable = selectedItems.filter(isSelectableSubmission);
  const unendorsable = selectedItems.filter(isUnendorsableSubmission);
  const reviewable = selectedItems.filter(isReviewableSubmission);
  const publishable = selectedItems.filter(isPublishableSubmission);
  const humanApprovable = selectedItems.filter(isApprovableSubmission);
  const actionableItems = items.filter(isBulkActionable);
  const selectedBatchCount = new Set(selectedItems.map((item) => item.batchId)).size;
  const hasBulkActions =
    approvable.length > 0 ||
    reviewable.length > 0 ||
    publishable.length > 0 ||
    humanApprovable.length > 0 ||
    unendorsable.length > 0 ||
    dismissable.length > 0;
  const activeDialog = dialogQueue[0];
  return (
    <>
      {noticeElement}
      {actionableItems.length > 0 && (
        <div className="admin-bulk-bar">
          <div className="admin-bulk-selection-toolbar">
            <div className="admin-bulk-selection-count" aria-live="polite" aria-atomic="true">
              <strong>已选 {selectedItems.length}</strong>
              <span>当前可选 {actionableItems.length}</span>
            </div>
            <label className="admin-submission-check admin-bulk-select-all">
              <span>全选本页</span>
              <input
                ref={allRef}
                type="checkbox"
                aria-label="全选本页"
                checked={
                  actionableItems.length > 0 &&
                  actionableItems.every((item) => selected.has(item.id))
                }
                onChange={(event) => {
                  if (event.target.checked)
                    setSelected(new Set(actionableItems.map((item) => item.id)));
                  else setSelected(new Set());
                }}
              />
            </label>
          </div>
          {selectedBatchCount > 1 && (
            <p className="admin-muted admin-bulk-note">
              所选条目分属 {selectedBatchCount} 个批次，将按批次分别确认。
            </p>
          )}
          {hasBulkActions && (
            <div className="admin-row-actions admin-bulk-actions">
              {approvable.length > 0 && (
                <button type="button" className="admin-primary" onClick={bulkApprove}>
                  批量批准 {approvable.length}
                </button>
              )}
              {reviewable.length > 0 && (
                <button type="button" onClick={bulkReview}>
                  启动独立审核 {reviewable.length}
                </button>
              )}
              {publishable.length > 0 && (
                <button type="button" onClick={bulkPublish}>
                  确认发布 {publishable.length}
                </button>
              )}
              {humanApprovable.length > 0 && (
                <button type="button" onClick={bulkApproveHuman}>
                  人工通过 {humanApprovable.length}
                </button>
              )}
              {unendorsable.length > 0 && (
                <button type="button" onClick={bulkUnendorse}>
                  批量撤回批准 {unendorsable.length}
                </button>
              )}
              {dismissable.length > 0 && (
                <button type="button" className="admin-library-danger" onClick={bulkDismiss}>
                  批量拒绝 {dismissable.length}
                </button>
              )}
            </div>
          )}
          {selectedItems.length > 0 &&
            approvable.length === 0 &&
            reviewable.length === 0 &&
            publishable.length === 0 &&
            humanApprovable.length === 0 &&
            unendorsable.length === 0 &&
            dismissable.length === 0 && (
              <span className="admin-muted">所选行都已处理完毕，没有可批量操作的内容。</span>
            )}
        </div>
      )}
      <div className="admin-library-cards" role="list" aria-label="待处理词条">
        {items.map((item) => (
          <LibraryCard
            key={item.id}
            item={item}
            game={game}
            selected={selected.has(item.id)}
            onSelect={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(item.id);
              else next.delete(item.id);
              setSelected(next);
            }}
            onSubmissionAction={(action) => queueSubmissionAction(action, [item])}
            onOpenItem={() => setDrawerItem(item)}
          />
        ))}
      </div>
      <CursorPager
        page={page}
        hasNext={data.nextCursor !== null}
        onPrevious={onPrevious}
        onNext={onNext}
      />
      {drawerItem !== null && (
        <SubmissionItemDrawer
          batchId={drawerItem.batchId}
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          onAction={(confirmation) => {
            const batchId = drawerItem.batchId;
            setDrawerItem(null);
            queueSubmissionAction(
              confirmation.action,
              confirmation.items.map((entry) => ({ ...entry, batchId })),
            );
          }}
        />
      )}
      {activeDialog !== undefined && (
        <SubmissionActionDialog
          key={activeDialog.batchId}
          batchId={activeDialog.batchId}
          confirmation={activeDialog.confirmation}
          multiBatch={activeDialog.totalGroups > 1}
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
  onSelect,
  onSubmissionAction,
  onOpenItem,
}: {
  item: WordLibraryItem;
  game: GameWordGame;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onSubmissionAction: (action: SubmissionConfirmation['action']) => void;
  onOpenItem: () => void;
}) {
  const actionable = isBulkActionable(item);
  return (
    <article className="admin-library-card" role="listitem">
      <label className="admin-submission-check">
        <input
          type="checkbox"
          aria-label={`选择${item.title}`}
          disabled={!actionable}
          checked={actionable && selected}
          onChange={(event) => onSelect(event.target.checked)}
        />
      </label>
      <div className="admin-library-card-content">
        <div className="admin-library-card-title">
          <button
            type="button"
            className="admin-text-button admin-library-word"
            aria-label={`查看${item.title}审核详情`}
            onClick={onOpenItem}
          >
            {item.title}
          </button>
          <StatusBadge>
            {item.agentName === SUPPLY_AGENT_NAME ? '后台生成' : 'Agent投稿'}
          </StatusBadge>
          <SubmissionStatus status={item.status} />
        </div>
        <p className="admin-library-meta">
          {WORD_GAME_LABELS[game]} · {item.category} · 来源 {item.agentName} ·{' '}
          <DateLabel value={item.createdAt} />
        </p>
        {item.definition !== null && <p className="admin-library-definition">{item.definition}</p>}
        {item.duplicateOf !== null && item.duplicateOf.startsWith('inventory:') && (
          <p className="admin-library-duplicate">
            <StatusBadge tone="danger" title="这个词已经在库里，发布时会被拦下">
              已有相同词在库
            </StatusBadge>
          </p>
        )}
        {(item.status === 'pending' || item.status === 'approved') && (
          <div className="admin-row-actions">
            {item.status === 'pending' && (
              <>
                <button
                  type="button"
                  className="admin-library-action admin-primary"
                  onClick={() => onSubmissionAction('endorse')}
                >
                  批准
                </button>
                <button
                  type="button"
                  className="admin-library-action admin-library-danger"
                  onClick={() => onSubmissionAction('dismiss')}
                >
                  拒绝
                </button>
              </>
            )}
            {item.status === 'approved' && (
              <>
                <button
                  type="button"
                  className="admin-library-action"
                  onClick={() => onSubmissionAction('unendorse')}
                >
                  撤回批准
                </button>
                <button
                  type="button"
                  className="admin-library-action admin-library-danger"
                  onClick={() => onSubmissionAction('dismiss')}
                >
                  拒绝
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

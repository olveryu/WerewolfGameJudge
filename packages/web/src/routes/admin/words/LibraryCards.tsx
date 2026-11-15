/** The submission card stream: one FIFO list of submission items, including
 * supply-produced ones (agent '系统补词'). Review and publish live only in
 * the batch detail. Inventory never enters the stream. */
import { useState } from 'react';

import type {
  GameWordGame,
  WordLibraryItem,
  WordLibraryItems,
} from '@/features/admin/model/adminContracts';
import { log } from '@/utils/logger';

import { CursorPager, DateLabel, StatusBadge } from '../components/Primitives';
import { SubmissionActionDialog, type SubmissionConfirmation } from './SubmissionActionDialog';
import { SubmissionStatus, SUPPLY_AGENT_NAME, WORD_GAME_LABELS } from './wordLabels';

const libraryLog = log.extend('AdminWordLibrary');

function isEndorsableSubmission(item: WordLibraryItem): boolean {
  return item.status === 'pending';
}

function isUnendorsableSubmission(item: WordLibraryItem): boolean {
  return item.status === 'approved';
}

function isDismissableSubmission(item: WordLibraryItem): boolean {
  return item.status === 'pending' || item.status === 'approved';
}

/** A row takes part in bulk actions only when at least one bulk verb applies to it. */
function isBulkActionable(item: WordLibraryItem): boolean {
  return (
    isEndorsableSubmission(item) || isUnendorsableSubmission(item) || isDismissableSubmission(item)
  );
}

function toConfirmationItem(item: WordLibraryItem): SubmissionConfirmation['items'][number] {
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
  onOpenBatch,
}: {
  game: GameWordGame;
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
  const selectedItems = items.filter((item) => selected.has(item.id));
  function queueSubmissionAction(
    action: SubmissionConfirmation['action'],
    rows: readonly WordLibraryItem[],
  ) {
    const groups = new Map<string, WordLibraryItem[]>();
    for (const item of rows) {
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
    queueSubmissionAction('endorse', selectedItems.filter(isEndorsableSubmission));
  }
  function bulkDismiss() {
    queueSubmissionAction('dismiss', selectedItems.filter(isDismissableSubmission));
  }
  function bulkUnendorse() {
    queueSubmissionAction('unendorse', selectedItems.filter(isUnendorsableSubmission));
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
          {search !== '' || status !== ''
            ? '没有匹配的词条，试试其他筛选条件。'
            : '暂无待处理词条。'}
        </p>
      </>
    );
  }
  const approvable = selectedItems.filter(isEndorsableSubmission);
  const dismissable = selectedItems.filter(isDismissableSubmission);
  const unendorsable = selectedItems.filter(isUnendorsableSubmission);
  const actionableItems = items.filter(isBulkActionable);
  const activeDialog = dialogQueue[0];
  return (
    <>
      {noticeElement}
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
            onOpenBatch={() => onOpenBatch(item.batchId)}
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
                actionableItems.length > 0 && actionableItems.every((item) => selected.has(item.id))
              }
              onChange={(event) => {
                if (event.target.checked)
                  setSelected(new Set(actionableItems.map((item) => item.id)));
                else setSelected(new Set());
              }}
            />
            已选 {selectedItems.length} / 当前可选 {actionableItems.length}
          </label>
          <button
            type="button"
            className="admin-primary"
            disabled={approvable.length === 0}
            onClick={bulkApprove}
          >
            批量批准 {approvable.length}
          </button>
          <button
            type="button"
            className="admin-danger-solid"
            disabled={dismissable.length === 0}
            onClick={bulkDismiss}
          >
            批量拒绝 {dismissable.length}
          </button>
          <button type="button" disabled={unendorsable.length === 0} onClick={bulkUnendorse}>
            批量撤回批准 {unendorsable.length}
          </button>
          {approvable.length === 0 && dismissable.length === 0 && unendorsable.length === 0 && (
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
  onSelect,
  onSubmissionAction,
  onOpenBatch,
}: {
  item: WordLibraryItem;
  game: GameWordGame;
  selected: boolean;
  onSelect: (checked: boolean) => void;
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
          <StatusBadge>
            {item.agentName === SUPPLY_AGENT_NAME ? '后台生成' : 'Agent投稿'}
          </StatusBadge>
          <SubmissionStatus status={item.status} />
          <p className="admin-library-meta">
            {WORD_GAME_LABELS[game]} · {item.category} · 来源 {item.agentName} ·{' '}
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
        <button
          type="button"
          className="admin-text-button"
          aria-label={`查看投稿批次：${item.title}`}
          onClick={onOpenBatch}
        >
          查看投稿批次
        </button>
        {item.status === 'pending' && (
          <>
            <button
              type="button"
              className="admin-text-button"
              onClick={() => onSubmissionAction('endorse')}
            >
              批准
            </button>
            <button
              type="button"
              className="admin-text-button admin-danger-text"
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
              className="admin-text-button"
              onClick={() => onSubmissionAction('unendorse')}
            >
              撤回批准
            </button>
            <button
              type="button"
              className="admin-text-button admin-danger-text"
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

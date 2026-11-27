/**
 * The visible lifecycle of a share run started outside the review dialog
 * (a host flow's 「分享战报」). Preparing and uploading are honest
 * spinners — neither reports progress, so no number is invented; the
 * capturing phase shows the capture's real count. Cancelling detaches
 * the wait without killing the background capture.
 */
import '@/components/CenterDialog.css';
import './review.css';

import { Portal } from '@ark-ui/react/portal';

import { AppDialog } from '@/components/AppDialog';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { TESTIDS } from '@/testids';

import type { RoomReviewShareRun } from '../useRoomReviewExport';

/** One status line for a run, shared by the modal and the dialog footer. */
export function formatReviewShareRun(run: RoomReviewShareRun): string {
  switch (run.phase) {
    case 'preparing':
      return '正在准备…';
    case 'capturing':
      return `正在生成 ${run.done}/${run.total}`;
    case 'uploading':
      return '正在上传…';
  }
}

export function RoomReviewProgressModal({
  run,
  onCancel,
}: {
  readonly run: RoomReviewShareRun;
  readonly onCancel: () => void;
}) {
  const status = formatReviewShareRun(run);
  return (
    <AppDialog.Root
      open
      role="alertdialog"
      onOpenChange={(details) => {
        if (!details.open) onCancel();
      }}
    >
      <Portal>
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner className="center-dialog-positioner">
          <AppDialog.Content
            className="center-dialog review-progress"
            data-testid={TESTIDS.roomReviewProgress}
          >
            <AppDialog.Title className="visually-hidden">分享战报</AppDialog.Title>
            <Spinner label={status} size="lg" />
            <p className="review-progress-status">{status}</p>
            {run.phase === 'capturing' && run.total > 0 && (
              <progress className="review-progress-bar" value={run.done} max={run.total} />
            )}
            <Button variant="ghost" onClick={onCancel} aria-label="取消分享">
              取消
            </Button>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}

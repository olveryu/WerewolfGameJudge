/**
 * The visible lifecycle of a share run started outside the review dialog
 * (a host flow's 「分享战报」). Preparing and uploading are honest
 * spinners — neither reports progress, so no number is invented; the
 * capturing phase shows the capture's real count. Cancelling detaches
 * the wait without killing the background capture.
 */
import './review.css';

import { AlertDialog } from '@/components/AlertDialog';
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
    <AlertDialog
      open
      title="分享战报"
      titleHidden
      media={<Spinner label={status} size="lg" />}
      buttons={[{ text: '取消', style: 'cancel', onPress: onCancel }]}
      onDismiss={onCancel}
      size="sm"
      testIds={{ content: TESTIDS.roomReviewProgress }}
    >
      <p className="review-progress-status">{status}</p>
      {run.phase === 'capturing' && run.total > 0 && (
        <progress className="review-progress-bar" value={run.done} max={run.total} />
      )}
    </AlertDialog>
  );
}

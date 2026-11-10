/**
 * Room shell status rows and small dialogs: the connection banner, the bot-seat takeover banner,
 * and the seat confirmation dialog. Pure presentation over shell models.
 */
import './RoomStatusBars.css';

import { memo } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { useNowMs } from '@/features/room/hooks/useNowMs';
import { getLinkCloseMessage } from '@/features/room/model/linkCloseMessages';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomControlledSeatModel } from '@/features/room/model/RoomShellModel';
import type { LinkStatus } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

const COUNTDOWN_TICK_MS = 250;

/** Seconds until `atMs`, never below 1 so the copy never reads 「0 秒后」. */
function secondsUntil(atMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((atMs - nowMs) / 1000));
}

function describeConnection(
  status: LinkStatus,
  pendingDurableCount: number,
  countdown: number | null,
): string {
  const hasPending = pendingDurableCount > 0;
  switch (status.kind) {
    case 'live':
      return '正在确认提交结果';
    case 'idle':
    case 'connecting':
    case 'syncing':
      return hasPending ? '行动已保存，连接后将自动确认' : '正在连接房间';
    case 'waiting':
      if (status.cause === 'offline') return '网络已断开，恢复后自动重连';
      if (status.cause === 'hidden') return '应用在后台，返回后自动重连';
      return countdown === null ? '连接断开，正在重连' : `连接断开，${countdown} 秒后重试`;
    case 'closed':
      return getLinkCloseMessage(status.reason);
  }
}

/**
 * Banner for every non-live link status: a sliding bar while connecting or syncing, a retry
 * countdown with 「立即重连」 while waiting, the terminal reason when closed, and 「正在确认提交结果」
 * while live with durable commands pending. Renders nothing when live with nothing pending.
 */
function ConnectionStatusBarComponent({
  status,
  pendingDurableCount,
  onRetryNow,
}: {
  readonly status: LinkStatus;
  /** Durable commands retained until the Worker returns a decision. */
  readonly pendingDurableCount: number;
  /** Reconnect immediately; only meaningful while `status.kind === 'waiting'`. */
  readonly onRetryNow: () => void;
}) {
  const retryAtMs = status.kind === 'waiting' ? status.nextRetryAtMs : null;
  const nowMs = useNowMs(COUNTDOWN_TICK_MS, retryAtMs !== null);
  const countdown = retryAtMs === null ? null : secondsUntil(retryAtMs, nowMs);
  const isLive = status.kind === 'live';
  if (isLive && pendingDurableCount === 0) return null;
  const text = describeConnection(status, pendingDurableCount, countdown);

  if (status.kind === 'waiting') {
    return (
      <div className="connection-bar" role="status" data-testid={TESTIDS.connectionStatusContainer}>
        <span className="connection-bar-text">{text}</span>
        <button
          type="button"
          className="connection-bar-retry"
          onClick={onRetryNow}
          data-testid={TESTIDS.connectionRetryNowButton}
        >
          立即重连
        </button>
      </div>
    );
  }
  const isAnimating = status.kind === 'connecting' || status.kind === 'syncing' || isLive;
  return (
    <div
      className="connection-bar"
      role="status"
      data-testid={isLive ? TESTIDS.connectionPendingContainer : TESTIDS.connectionStatusContainer}
    >
      <span className="connection-bar-text">{text}</span>
      {isAnimating && (
        <span className="connection-bar-track" aria-hidden>
          <span className="connection-bar-indeterminate" />
        </span>
      )}
    </div>
  );
}

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

/** Reports the host's active bot-seat takeover. */
export function ControlledSeatBanner({ model }: { readonly model: RoomControlledSeatModel }) {
  return (
    <div className="controlled-seat-banner" data-testid={TESTIDS.controlledSeatBanner}>
      <span className="controlled-seat-banner-text">
        <IconGameControllerOutline aria-hidden />
        {` 正在操控 ${model.seat + 1} 号位（${model.displayName}）`}
      </span>
      <button
        type="button"
        className="controlled-seat-banner-release"
        onClick={model.onRelease}
        data-testid={TESTIDS.controlledSeatReleaseButton}
        aria-label="退出机器人接管"
      >
        退出接管
      </button>
    </div>
  );
}

function seatConfirmationCopy(model: RoomSeatConfirmationModel) {
  switch (model.action.kind) {
    case 'take':
      return {
        title: '入座',
        message: `确定在${model.action.toSeat + 1}号位入座？`,
        confirmText: '入座',
        submittingText: '入座中',
      };
    case 'move':
      return {
        title: '换座',
        message: `确定从${model.action.fromSeat + 1}号位换到${model.action.toSeat + 1}号位？`,
        confirmText: '换座',
        submittingText: '换座中',
      };
  }
}

/** Confirmation for taking or moving to a seat; cannot be dismissed while submitting. */
export function RoomSeatConfirmModal({ model }: { readonly model: RoomSeatConfirmationModel }) {
  const copy = seatConfirmationCopy(model);
  return (
    <CenterDialog
      open
      onClose={() => {
        if (!model.isSubmitting) model.onCancel();
      }}
      title={copy.title}
      titleTestId={TESTIDS.seatConfirmTitle}
      testId={TESTIDS.seatConfirmModal}
    >
      <p className="seat-confirm-message" data-testid={TESTIDS.seatConfirmMessage}>
        {copy.message}
      </p>
      <div className="center-dialog-actions">
        <Button
          variant="secondary"
          disabled={model.isSubmitting}
          onClick={model.onCancel}
          data-testid={TESTIDS.seatConfirmCancel}
        >
          取消
        </Button>
        <Button
          loading={model.isSubmitting}
          onClick={() => void model.onConfirm()}
          data-testid={TESTIDS.seatConfirmOk}
        >
          {model.isSubmitting ? copy.submittingText : copy.confirmText}
        </Button>
      </div>
    </CenterDialog>
  );
}

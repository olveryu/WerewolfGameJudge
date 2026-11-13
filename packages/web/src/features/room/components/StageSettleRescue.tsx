/**
 * StageSettleRescue — the one host self-rescue / waiting display for an
 * overdue stage deadline (D3 follow-up).
 *
 * The overdue decision lives once in `useStageDeadline` (`isOverdue`:
 * deadline passed + its grace); this component only renders it. It shows
 * nothing while the countdown runs or without a deadline. At zero it always
 * shows the game's waiting sentence — before the grace elapses that is all
 * (the server alarm can arrive seconds late); once overdue the host also
 * gets a retry button that re-drives the settle through the game's
 * `<game>.phase.retrySettle`, while non-hosts see a waiting-for-host hint.
 * Rejections surface through the room's submit pipeline; the sentences are
 * per-game props.
 */
import './StageSettleRescue.css';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import IconRefreshOutline from '~icons/ion/refresh-outline';

interface StageSettleRescueProps {
  /** Remaining whole seconds; null without a deadline. */
  readonly remainingSeconds: number | null;
  /** From `useStageDeadline`: the deadline passed and the grace elapsed. */
  readonly isOverdue: boolean;
  /** Only the host sees the retry button. */
  readonly isHost: boolean;
  /** The room session's in-flight flag: the retry button shows busy while it is set. */
  readonly isRetrying: boolean;
  /** Submits the game's `<game>.phase.retrySettle` command. */
  readonly onRetry: () => void;
  /** Per-game sentence shown once the countdown reaches zero. */
  readonly waitingLabel: string;
  readonly retryLabel?: string;
  readonly waitingForHostLabel?: string;
}

/** Renders the waiting sentence at zero and the host retry once the settle is overdue. */
export function StageSettleRescue({
  remainingSeconds,
  isOverdue,
  isHost,
  isRetrying,
  onRetry,
  waitingLabel,
  retryLabel = '重新推进',
  waitingForHostLabel = '等待房主处理',
}: StageSettleRescueProps) {
  if (remainingSeconds === null || remainingSeconds > 0) return null;
  return (
    <div className="stage-settle-rescue" data-testid={TESTIDS.stageSettleRescue}>
      <p className="stage-settle-rescue-waiting">{waitingLabel}</p>
      {isOverdue &&
        (isHost ? (
          <Button
            variant="secondary"
            loading={isRetrying}
            onClick={onRetry}
            data-testid={TESTIDS.stageSettleRescueRetryButton}
          >
            <IconRefreshOutline aria-hidden />
            {retryLabel}
          </Button>
        ) : (
          <p className="stage-settle-rescue-hint">{waitingForHostLabel}</p>
        ))}
    </div>
  );
}

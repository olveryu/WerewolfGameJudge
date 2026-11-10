/** FibKing public summary and preparation status above the shared seat board. */
import './FibRoomSummary.css';

import type {
  FibPhase,
  FibPreparationFailureCode,
  FibPreparationStage,
} from '@game-judge/game-engine/games/fibking/public';
import type { ReactNode } from 'react';

import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { TESTIDS } from '@/testids';
import IconAlertCircleOutline from '~icons/ion/alert-circle-outline';
import IconTimeOutline from '~icons/ion/time-outline';

interface FibRoomSummaryProps {
  readonly headerRight?: ReactNode;
  readonly phase: FibPhase;
  readonly playerCount: number;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
}

const PREPARATION_STAGE_LABELS: Readonly<Record<FibPreparationStage, string>> = {
  queued: '等待选取词语',
  selecting: '正在选取中文词语',
  finalizing: '正在检查词语和释义',
};

const INVENTORY_EXHAUSTED_LABEL = '本桌新题已用完，请等待题库更新';

/** The 瞎掰王 configuration line plus the live word-preparation status. */
export function FibRoomSummary({
  headerRight,
  phase,
  playerCount,
  preparationStage,
  preparationFailureCode,
}: FibRoomSummaryProps) {
  // The summary carries configuration only. Preparation stage detail
  // stays while preparing; of the failure codes only inventory
  // exhaustion is explained here — a plain selection failure is the
  // host console's retry primary and the players' bottom message.
  const preparationStatus =
    phase === 'preparing'
      ? preparationStage === null
        ? null
        : PREPARATION_STAGE_LABELS[preparationStage]
      : phase === 'preparationFailed' && preparationFailureCode === 'inventoryExhausted'
        ? INVENTORY_EXHAUSTED_LABEL
        : null;
  if (phase === 'preparing' && preparationStatus === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }
  if (phase === 'preparationFailed' && preparationFailureCode === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }
  const isFailed = phase === 'preparationFailed';

  return (
    <RoomGameSummary
      headerRight={headerRight}
      icon="bulb-outline"
      title={`瞎掰王 · ${playerCount}人局`}
    >
      {preparationStatus !== null && (
        <p
          className={`fib-preparation-status${isFailed ? ' fib-preparation-status-failed' : ''}`}
          role="status"
        >
          {isFailed ? (
            <IconAlertCircleOutline className="fib-preparation-status-icon" aria-hidden />
          ) : (
            <IconTimeOutline className="fib-preparation-status-icon" aria-hidden />
          )}
          <span data-testid={TESTIDS.fibPreparationStatus}>{preparationStatus}</span>
        </p>
      )}
    </RoomGameSummary>
  );
}

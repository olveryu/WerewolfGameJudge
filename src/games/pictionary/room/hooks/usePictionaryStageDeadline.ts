/** Drive Pictionary phase expiry from authoritative absolute deadlines. */

import { useEffect, useState } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const DEADLINE_REFRESH_INTERVAL_MS = 250;
const EARLY_EXPIRY_RETRY_DELAY_MS = 1_000;

interface UsePictionaryStageDeadlineParams {
  readonly deadlineAt: number | null;
  readonly phaseRevision: number;
  readonly canExpire: boolean;
  readonly session: PictionaryRoomSession;
}

interface PictionaryStageDeadline {
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
}

function getRemainingMilliseconds(deadlineAt: number | null): number | null {
  return deadlineAt === null ? null : Math.max(0, deadlineAt - Date.now());
}

/** Recompute a display countdown from an absolute deadline after timer throttling or app resume. */
export function usePictionaryRemainingSeconds(deadlineAt: number | null): number | null {
  const isAppVisible = useAppVisibility();
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(() =>
    getRemainingMilliseconds(deadlineAt),
  );

  useEffect(() => {
    const refresh = (): void => setRemainingMilliseconds(getRemainingMilliseconds(deadlineAt));
    refresh();
    if (deadlineAt === null || !isAppVisible) return;
    const interval = setInterval(refresh, DEADLINE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [deadlineAt, isAppVisible]);

  return remainingMilliseconds === null ? null : Math.ceil(remainingMilliseconds / 1_000);
}

/**
 * Recomputes remaining time from the server deadline instead of accumulating local ticks.
 *
 * @remarks Seated clients and the room host may request expiry. The phase revision makes those
 * requests idempotent, while the local lock prevents concurrent requests from one client.
 */
export function usePictionaryStageDeadline({
  deadlineAt,
  phaseRevision,
  canExpire,
  session,
}: UsePictionaryStageDeadlineParams): PictionaryStageDeadline {
  const isAppVisible = useAppVisibility();
  const remainingSeconds = usePictionaryRemainingSeconds(deadlineAt);

  useEffect(() => {
    if (remainingSeconds !== 0 || !canExpire || !isAppVisible) return;
    let isExpiryInFlight = false;
    let isMounted = true;

    const requestExpiry = async (): Promise<void> => {
      if (isExpiryInFlight) return;
      isExpiryInFlight = true;
      try {
        const result = await session.dispatch(
          { type: 'pictionary.phase.expire', phaseRevision },
          { controlledSeat: null, label: '推进接龙阶段', isRecoverable: true },
        );
        if (!isSuccessfulRoomCommand(result)) {
          roomScreenLog.warn('Pictionary phase expiry was not accepted', {
            phaseRevision,
            outcomeKind: result.kind,
          });
        }
      } catch (error: unknown) {
        if (isMounted) {
          handleError(error, {
            label: '推进接龙阶段',
            logger: roomScreenLog,
            alertMessage: '接龙阶段推进失败，请稍后重试。',
          });
        }
      } finally {
        isExpiryInFlight = false;
      }
    };

    void requestExpiry();
    const interval = setInterval(() => void requestExpiry(), EARLY_EXPIRY_RETRY_DELAY_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [canExpire, isAppVisible, phaseRevision, remainingSeconds, session]);

  return {
    remainingSeconds,
    isExpired: remainingSeconds === 0,
  };
}

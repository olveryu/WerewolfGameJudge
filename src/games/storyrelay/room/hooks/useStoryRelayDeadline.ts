/** Requests due Story Relay transitions against server revisions; foreground clients share this duty. */

import { useEffect, useState } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const DEADLINE_REFRESH_MS = 1000;

/** Recomputes time after throttling and resumes expiry requests after reconnect. */
export function useStoryRelayDeadline(
  deadlineAt: number | null,
  phaseRevision: number,
  session: StoryRelayRoomSession,
): number | null {
  const isVisible = useAppVisibility();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  useEffect(() => {
    let isRunning = false;
    let isMounted = true;
    const tick = async () => {
      const remaining =
        deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      const current = session.getSnapshot();
      if (
        remaining !== 0 ||
        isRunning ||
        current.phase !== 'ready' ||
        current.connection !== 'live' ||
        current.pendingCommandCount > 0 ||
        current.snapshot.state.phaseRevision !== phaseRevision
      )
        return;
      isRunning = true;
      try {
        await session.dispatch(
          { type: 'storyrelay.phase.expire', phaseRevision },
          { controlledSeat: null, label: '推进故事阶段', isRecoverable: true },
        );
      } catch (error: unknown) {
        if (isMounted)
          handleError(error, {
            label: '推进故事阶段',
            logger: roomScreenLog,
            alertMessage: '阶段推进失败，请重试',
          });
      } finally {
        isRunning = false;
      }
    };
    if (!isVisible) return;
    void tick();
    const interval = setInterval(() => void tick(), DEADLINE_REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [deadlineAt, isVisible, phaseRevision, session]);
  return remainingSeconds;
}

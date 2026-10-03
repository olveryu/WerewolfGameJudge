/**
 * 从权威 deadlineAt 推导剩余秒数；到点时请求一次幂等的阶段推进。
 *
 * 前台客户端共同承担推进职责；同一 phaseRevision 的到点请求保持 single-flight。
 */

import { useEffect, useState } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const DEADLINE_REFRESH_MS = 1000;

export interface DrawGuessDeadline {
  /** 剩余秒数；无倒计时阶段为 null。 */
  readonly remainingSeconds: number | null;
}

/** 按 deadlineAt - Date.now() 重新推导剩余时间；tick 只更新显示。 */
export function useDrawGuessDeadline(
  deadlineAt: number | null,
  phaseRevision: number,
  turnIndex: number,
  session: DrawGuessRoomSession,
): DrawGuessDeadline {
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
          { type: 'drawguess.phase.expire', phaseRevision, turnIndex },
          { controlledSeat: null, label: '推进作画阶段', isRecoverable: true },
        );
      } catch (error: unknown) {
        if (isMounted)
          handleError(error, {
            label: '推进作画阶段',
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
  }, [deadlineAt, isVisible, phaseRevision, turnIndex, session]);
  return { remainingSeconds };
}

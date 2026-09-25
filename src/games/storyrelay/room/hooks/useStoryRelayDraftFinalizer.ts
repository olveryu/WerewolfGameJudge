/** Finalizes all locally owned Story Relay drafts through the platform's recoverable command queue. */

import {
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useEffect, useState } from 'react';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import {
  getStoryRelayUserSeat,
  type StoryRelayRoomSession,
} from '@/games/storyrelay/model/StoryRelayRoomSession';
import {
  getStoryRelayOwnedTasks,
  reconcileStoryRelayDrafts,
  storyRelayDraftKey,
  storyRelayDrafts,
} from '@/games/storyrelay/services/storyRelayDrafts';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export type StoryRelayFinalizationStatus =
  | 'idle'
  | 'submitting'
  | 'retrying'
  | 'waiting'
  | 'failed';

/** Initializes empty drafts only while actually present during the writing phase. */
function initializeDrafts(state: StoryRelayState, roomId: string, userId: string): void {
  for (const task of getStoryRelayOwnedTasks(state, userId)) {
    const key = storyRelayDraftKey(roomId, userId, task);
    if (storyRelayDrafts.read(key) === null) storyRelayDrafts.write(key, '');
  }
}

/** Keeps local manuscripts until a matching server entry or successful delivery confirms them. */
export function useStoryRelayDraftFinalizer(
  state: StoryRelayState,
  roomId: string,
  userId: string,
  session: StoryRelayRoomSession,
) {
  const [status, setStatus] = useState<StoryRelayFinalizationStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const roundId = state.roundId;
  const stepIndex = state.stepIndex;
  const phase = state.phase;
  useEffect(() => {
    reconcileStoryRelayDrafts(state, roomId, userId);
  }, [state, roomId, userId]);
  useEffect(() => {
    const initial = session.getSnapshot();
    if (initial.phase !== 'ready') return;
    if (phase === 'answering') {
      initializeDrafts(initial.snapshot.state, roomId, userId);
      setStatus('idle');
      return;
    }
    if (phase !== 'settling') {
      setStatus('idle');
      return;
    }
    let isMounted = true;
    let isRunning = false;
    let hasFailure = false;
    const reconcile = (current: StoryRelayState) =>
      reconcileStoryRelayDrafts(current, roomId, userId);
    const run = async () => {
      if (!isMounted || isRunning || hasFailure) return;
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return;
      reconcile(current.snapshot.state);
      if (current.connection !== 'live' || current.pendingCommandCount > 0) {
        setStatus('retrying');
        return;
      }
      if (
        current.snapshot.state.roundId !== roundId ||
        current.snapshot.state.stepIndex !== stepIndex ||
        current.snapshot.state.phase !== 'settling'
      )
        return;
      isRunning = true;
      setStatus('submitting');
      try {
        const mySeat = getStoryRelayUserSeat(current.snapshot.state, userId);
        let hasInvalidDrafts = false;
        for (const task of getStoryRelayOwnedTasks(current.snapshot.state, userId)) {
          if (task.isSubmitted) continue;
          const key = storyRelayDraftKey(roomId, userId, task);
          const text = storyRelayDrafts.read(key);
          if (text === null) continue;
          if (text.length > STORY_RELAY_TEXT_MAX_LENGTH) {
            hasInvalidDrafts = true;
            continue;
          }
          const identity = {
            roundId: task.roundId,
            stepIndex: task.stepIndex,
            chainId: task.chainId,
          };
          const result = await session.dispatch(
            text.trim().length === 0
              ? { type: 'storyrelay.task.empty.submit', ...identity }
              : { type: 'storyrelay.text.submit', ...identity, text },
            {
              controlledSeat: task.authorSeat === mySeat ? null : task.authorSeat,
              label: '提交故事稿件',
              isRecoverable: true,
            },
          );
          if (!isMounted) return;
          if (result.kind !== 'decided') {
            setStatus('retrying');
            return;
          }
          if (!isSuccessfulRoomCommand(result)) {
            const latest = session.getSnapshot();
            if (latest.phase === 'ready') {
              reconcile(latest.snapshot.state);
              if (
                latest.snapshot.state.chains.find((chain) => chain.id === task.chainId)?.entries[
                  task.stepIndex
                ] !== undefined
              )
                continue;
            }
            throw new Error(getRoomCommandFailureReason(result));
          }
          storyRelayDrafts.clear(key);
        }
        if (hasInvalidDrafts) throw new Error('正文超过 512 字符，草稿已保留，请修改后重试');
        if (isMounted) setStatus('waiting');
      } catch (error: unknown) {
        if (isMounted) {
          hasFailure = true;
          setStatus('failed');
          handleError(error, {
            label: '提交故事稿件',
            logger: roomScreenLog,
            alertMessage: '收稿失败，草稿已保留，请检查并重试',
          });
        }
      } finally {
        isRunning = false;
      }
    };
    const unsubscribe = session.subscribe(() => {
      void run();
    });
    void run();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [attempt, phase, roomId, roundId, session, stepIndex, userId]);
  return { status, retry: () => setAttempt((current) => current + 1) };
}

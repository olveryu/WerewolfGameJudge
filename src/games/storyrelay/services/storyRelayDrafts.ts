/** Device-local task drafts; keys isolate room instances, accounts, rounds, stories and authors. */

import {
  getStoryRelayTaskForSeat,
  type StoryRelayState,
  type StoryRelayTask,
} from '@game-judge/game-engine/games/storyrelay/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';

import { getStoryRelayUserSeat } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { storage } from '@/services/infra/localStorage';

/** Returns all tasks this account can submit, independent of the displayed bot tab. */
export function getStoryRelayOwnedTasks(
  state: StoryRelayState,
  userId: string,
): readonly StoryRelayTask[] {
  const mySeat = getStoryRelayUserSeat(state, userId);
  const seats = [
    ...(mySeat === null ? [] : [mySeat]),
    ...(state.hostUserId === userId ? state.botSeats : []),
  ];
  return seats.map((seat) => {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error('Story Relay owned seat has no active task');
    return task;
  });
}

/** Generates an unambiguous task key including the immutable room ID. */
export function storyRelayDraftKey(
  roomId: string,
  userId: string,
  task: Pick<StoryRelayTask, 'roundId' | 'chainId' | 'stepIndex' | 'authorSeat'>,
): string {
  if (roomId.length === 0 || userId.length === 0)
    throw new Error('Story Relay draft identity missing');
  return `@storyrelay:draft:${canonicalJson([roomId, userId, task.roundId, task.chainId, task.stepIndex, task.authorSeat])}`;
}

export const storyRelayDrafts = {
  /** Missing differs from an explicitly empty local draft. */
  read(key: string): string | null {
    return storage.getString(key) ?? null;
  },
  /** Preserve the original draft, including invalid length, until corrected or acknowledged. */
  write(key: string, text: string): void {
    storage.set(key, text);
  },
  /** Remove only the acknowledged task, never the whole account's drafts. */
  clear(key: string): void {
    storage.remove(key);
  },
};

/** Reads retained manuscripts from accepted author assignments and the current owned tasks. */
export function readStoryRelayRoundDrafts(state: StoryRelayState, roomId: string, userId: string) {
  if (state.roundId === null) return [];
  const drafts = new Map<
    string,
    {
      readonly key: string;
      readonly authorSeat: number;
      readonly stepIndex: number;
      readonly text: string;
    }
  >();
  const tasks = state.chains.flatMap((chain) =>
    chain.entries.map((entry, stepIndex) => ({
      roundId: state.roundId!,
      chainId: chain.id,
      stepIndex,
      authorSeat: entry.authorSeat,
    })),
  );
  if (state.phase === 'answering' || state.phase === 'settling' || state.phase === 'transition')
    tasks.push(...getStoryRelayOwnedTasks(state, userId));
  for (const task of tasks) {
    const key = storyRelayDraftKey(roomId, userId, task);
    const text = storyRelayDrafts.read(key);
    if (text !== null)
      drafts.set(key, { key, authorSeat: task.authorSeat, stepIndex: task.stepIndex, text });
  }
  return [...drafts.values()];
}

/** Reconciles accepted content even when a snapshot reaches the next phase before the HTTP response. */
export function reconcileStoryRelayDrafts(
  state: StoryRelayState,
  roomId: string,
  userId: string,
): void {
  if (state.roundId === null) return;
  for (const chain of state.chains)
    for (const [stepIndex, entry] of chain.entries.entries()) {
      if (entry.kind === 'skipped') continue;
      const key = storyRelayDraftKey(roomId, userId, {
        roundId: state.roundId,
        chainId: chain.id,
        stepIndex,
        authorSeat: entry.authorSeat,
      });
      const text = storyRelayDrafts.read(key);
      if (text !== null && (entry.kind === 'text' ? entry.text === text : text.trim().length === 0))
        storyRelayDrafts.clear(key);
    }
}

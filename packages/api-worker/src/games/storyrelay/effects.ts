/** Worker-side execution for the Story Relay game-completed growth settlement effect. */

import type {
  StoryRelayEffect,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

/** Deliver the terminal Story Relay settlement effect through the shared reward ledger. */
export async function handleStoryRelayEffect(
  effect: StoryRelayEffect,
  context: WorkerEffectContext<StoryRelayState, never>,
): Promise<void> {
  await publishGameRewards(
    { ...effect.payload, kind: 'completion', gameType: 'storyrelay' },
    context,
  );
}

/** Worker-side execution for the Pictionary game-completed growth settlement effect. */

import type {
  PictionaryEffect,
  PictionaryInternalCommand,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

/** Deliver the terminal Pictionary settlement effect through the shared reward ledger. */
export async function handlePictionaryEffect(
  effect: PictionaryEffect,
  context: WorkerEffectContext<PictionaryState, PictionaryInternalCommand>,
): Promise<void> {
  await publishGameRewards(
    { ...effect.payload, kind: 'completion', gameType: 'pictionary' },
    context,
  );
}

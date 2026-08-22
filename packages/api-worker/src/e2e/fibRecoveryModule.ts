/** E2E-only Fib module that interrupts once after persisting a round selection. */

import type {
  FibEffect,
  FibInternalCommand,
  FibState,
} from '@game-judge/game-engine/games/fibking/public';

import { fibEffectSchema, handleFibEffect } from '../games/fibking/effects';
import { fibWorkerModule } from '../games/fibking/module';
import { getFibWordHistoryUserIds } from '../games/fibking/wordHistory';
import { getOrCreateFibWordSelection } from '../games/fibking/wordSelection';
import type { WorkerEffectContext } from '../platform/gameModules/workerModule';
import {
  defineWorkerGameModule,
  registerWorkerGameModule,
} from '../platform/gameModules/workerModule';

async function hasPersistedSelection(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<boolean> {
  const row = await context.bindings.DB.prepare(
    `SELECT effect_id
     FROM fib_round_word_selections
     WHERE room_id = ? AND effect_id = ?`,
  )
    .bind(context.roomIdentity.roomId, context.effectId)
    .first<{ readonly effect_id: string }>();
  return row !== null;
}

async function handleRecoverableFibEffect(
  effect: FibEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<void> {
  if (effect.type !== 'fib.word.select') {
    await handleFibEffect(effect, context);
    return;
  }
  if (context.state.phase !== 'preparing') return;
  if (!(await hasPersistedSelection(context))) {
    await getOrCreateFibWordSelection({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
      participantUserIds: getFibWordHistoryUserIds(context.state),
    });
    throw new Error('[E2E] Interrupted Fib effect after round-selection persistence');
  }
  await handleFibEffect(effect, context);
}

const e2eFibWorkerModuleDefinition = defineWorkerGameModule({
  ...fibWorkerModule,
  effectSchema: fibEffectSchema,
  handleEffect: handleRecoverableFibEffect,
});

export const e2eFibWorkerModule = registerWorkerGameModule(e2eFibWorkerModuleDefinition);

/** E2E-only Fib module that interrupts once after persisting the provider result. */

import type {
  FibEffect,
  FibInternalCommand,
  FibState,
} from '@game-judge/game-engine/games/fibking/public';

import { fibEffectSchema, handleFibGenerateWordEffect } from '../games/fibking/effects';
import { fibWorkerModule } from '../games/fibking/module';
import { getOrCreateFibWordGenerationResult } from '../games/fibking/wordGenerationResults';
import { getFibWordHistoryUserIds } from '../games/fibking/wordHistory';
import { createLocalFibWordProvider } from '../games/fibking/wordProviders/local';
import type { WorkerEffectContext } from '../platform/gameModules/workerModule';
import {
  defineWorkerGameModule,
  registerWorkerGameModule,
} from '../platform/gameModules/workerModule';

async function hasPersistedProviderResult(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<boolean> {
  const row = await context.bindings.DB.prepare(
    `SELECT effect_id
     FROM fib_word_generation_results
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
  const provider = createLocalFibWordProvider();
  if (!(await hasPersistedProviderResult(context))) {
    await getOrCreateFibWordGenerationResult({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
      provider,
      historyUserIds: getFibWordHistoryUserIds(context.state),
    });
    throw new Error('[E2E] Interrupted Fib effect after provider-result persistence');
  }
  await handleFibGenerateWordEffect(effect, context, provider);
}

const e2eFibWorkerModuleDefinition = defineWorkerGameModule({
  ...fibWorkerModule,
  effectSchema: fibEffectSchema,
  handleEffect: handleRecoverableFibEffect,
});

export const e2eFibWorkerModule = registerWorkerGameModule(e2eFibWorkerModuleDefinition);

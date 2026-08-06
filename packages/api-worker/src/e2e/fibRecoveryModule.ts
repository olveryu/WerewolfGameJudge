/** E2E-only Fib module that interrupts once after persisting the catalog result. */

import type {
  FibEffect,
  FibInternalCommand,
  FibState,
} from '@game-judge/game-engine/games/fibking/public';

import {
  ensureFibSelectingWordStage,
  fibEffectSchema,
  handleFibGenerateWordEffect,
  handleFibTerminalEffect,
} from '../games/fibking/effects';
import { fibWorkerModule } from '../games/fibking/module';
import { getOrCreateFibWordGenerationResult } from '../games/fibking/wordGenerationResults';
import { getFibWordHistoryUserIds } from '../games/fibking/wordHistory';
import type { EffectExecutionResult } from '../platform/gameModules/runtimeGameModule';
import type { WorkerEffectContext } from '../platform/gameModules/workerModule';
import {
  defineWorkerGameModule,
  registerWorkerGameModule,
} from '../platform/gameModules/workerModule';

async function hasPersistedCatalogResult(
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
): Promise<EffectExecutionResult> {
  if (!(await hasPersistedCatalogResult(context))) {
    if (!(await ensureFibSelectingWordStage(effect, context))) return { kind: 'success' };
    await getOrCreateFibWordGenerationResult({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
      historyUserIds: getFibWordHistoryUserIds(context.state),
    });
    return {
      kind: 'retryable',
      error: new Error('[E2E] Interrupted Fib effect after catalog-result persistence'),
    };
  }
  return handleFibGenerateWordEffect(effect, context);
}

const e2eFibWorkerModuleDefinition = defineWorkerGameModule({
  ...fibWorkerModule,
  effectSchema: fibEffectSchema,
  handleEffect: handleRecoverableFibEffect,
  handleTerminalEffect: handleFibTerminalEffect,
});

export const e2eFibWorkerModule = registerWorkerGameModule(e2eFibWorkerModuleDefinition);

/**
 * Executor registry — Maps ActionIntentType → IntentExecutor
 *
 * Starts empty; executors are registered by C09/C10 commits.
 * `dispatchIntent` is the entry point: looks up the registry,
 * returns true if handled, false if the caller should fall through
 * to the existing switch.
 */

import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import { roomScreenLog } from '@/utils/logger';

import type { ExecutorContext, ExecutorMap, IntentExecutor } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Registry (mutable singleton — populated at module init by executor files)
// ─────────────────────────────────────────────────────────────────────────────

const executors: ExecutorMap = {};

/** Clear all registered executors. Called before re-registration to support HMR. */
export function clearExecutors(): void {
  for (const key of Object.keys(executors)) {
    delete executors[key as keyof ExecutorMap];
  }
}

/**
 * Register an executor for a specific ActionIntentType.
 * Throws if a duplicate registration is attempted (fail-fast).
 */
export function registerExecutor(type: ActionIntent['type'], executor: IntentExecutor): void {
  if (executors[type]) {
    throw new Error(`[FAIL-FAST] Duplicate executor registration for '${type}'`);
  }
  executors[type] = executor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to dispatch an intent via the executor registry.
 *
 * @returns `true` if an executor handled the intent, `false` if no executor
 *          was registered (caller should fall through to legacy switch).
 */
export async function dispatchIntent(intent: ActionIntent, ctx: ExecutorContext): Promise<boolean> {
  const executor = executors[intent.type];
  if (!executor) return false;

  roomScreenLog.debug('dispatchIntent Delegating to executor', { type: intent.type });
  await executor(intent, ctx);
  return true;
}

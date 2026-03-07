/**
 * Executors barrel export
 *
 * Re-exports the public API: registry functions, dispatch entry point,
 * and the executor types needed by individual executor modules.
 */

export { dispatchIntent, registerExecutor } from './registry';
export type { ExecutorContext, ExecutorMap, IntentExecutor } from './types';

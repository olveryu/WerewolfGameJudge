/**
 * Executors barrel export
 *
 * Re-exports the public API: registry functions, dispatch entry point,
 * and the executor types needed by individual executor modules.
 * Side-effect imports below trigger registerExecutor calls at module init.
 */

// ── C09 executors ──────────────────────────────────────────────────────────
import { actionConfirmExecutor, magicianFirstExecutor } from './actionSubmitExecutor';
import { registerExecutor } from './registry';
import { revealExecutor } from './revealExecutor';
import { skipExecutor } from './skipExecutor';
import { wolfVoteExecutor } from './wolfVoteExecutor';

registerExecutor('reveal', revealExecutor);
registerExecutor('magicianFirst', magicianFirstExecutor);
registerExecutor('wolfVote', wolfVoteExecutor);
registerExecutor('actionConfirm', actionConfirmExecutor);
registerExecutor('skip', skipExecutor);

// ── Public API ─────────────────────────────────────────────────────────────
export { dispatchIntent } from './registry';
export type { ExecutorContext, ExecutorMap, IntentExecutor } from './types';

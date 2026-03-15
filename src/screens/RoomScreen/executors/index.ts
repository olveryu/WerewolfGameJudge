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

// ── C10 executors ──────────────────────────────────────────────────────────
import { groupConfirmAckExecutor } from './groupConfirmExecutor';
import { multiSelectConfirmExecutor, multiSelectToggleExecutor } from './multiSelectExecutor';
import { actionPromptExecutor, confirmTriggerExecutor } from './promptExecutor';
import { wolfRobotViewHunterStatusExecutor } from './wolfRobotExecutor';

registerExecutor('actionPrompt', actionPromptExecutor);
registerExecutor('confirmTrigger', confirmTriggerExecutor);
registerExecutor('wolfRobotViewHunterStatus', wolfRobotViewHunterStatusExecutor);
registerExecutor('multiSelectToggle', multiSelectToggleExecutor);
registerExecutor('multiSelectConfirm', multiSelectConfirmExecutor);
registerExecutor('groupConfirmAck', groupConfirmAckExecutor);

// ── Compile-time exhaustive check ──────────────────────────────────────────
// If a new ActionIntentType is added but not registered above, this will
// produce a TS error: "Type '...' does not satisfy 'CompleteExecutorMap'."
import type { CompleteExecutorMap } from './types';

const _exhaustiveCheck = {
  reveal: revealExecutor,
  magicianFirst: magicianFirstExecutor,
  wolfVote: wolfVoteExecutor,
  actionConfirm: actionConfirmExecutor,
  skip: skipExecutor,
  actionPrompt: actionPromptExecutor,
  confirmTrigger: confirmTriggerExecutor,
  wolfRobotViewHunterStatus: wolfRobotViewHunterStatusExecutor,
  multiSelectToggle: multiSelectToggleExecutor,
  multiSelectConfirm: multiSelectConfirmExecutor,
  groupConfirmAck: groupConfirmAckExecutor,
} satisfies CompleteExecutorMap;

// Suppress unused-variable lint — _exhaustiveCheck is intentionally type-only.
void _exhaustiveCheck;

// ── Public API ─────────────────────────────────────────────────────────────
export { dispatchIntent } from './registry';
export type { ExecutorContext } from './types';

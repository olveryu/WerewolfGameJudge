/**
 * skipExecutor — Handles 'skip' ActionIntent
 *
 * Shows a skip-confirmation dialog, then submits the canonical skip input.
 */

import type { IntentExecutor } from './types';

/** Skip-action executor. */
export const skipExecutor: IntentExecutor = (_intent, ctx) => {
  const { proceedWithAction, actionDialogs } = ctx;

  actionDialogs.showConfirmDialog('跳过本次行动？', '确定跳过本次行动吗？', async () => {
    await proceedWithAction({ kind: 'skip' });
  });
};

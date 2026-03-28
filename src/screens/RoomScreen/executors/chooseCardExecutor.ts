/**
 * chooseCardExecutor — Handles 'chooseCard' ActionIntent
 *
 * Opens the bottom card selection modal. Actual card selection and submission
 * are handled by the modal's onChoose callback (wired in RoomScreen).
 */

import type { IntentExecutor } from './types';

export const chooseCardExecutor: IntentExecutor = (_intent, ctx) => {
  ctx.openChooseCardModal?.();
};

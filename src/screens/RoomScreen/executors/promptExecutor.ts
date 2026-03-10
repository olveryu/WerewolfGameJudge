/**
 * promptExecutor — Handles 'actionPrompt' and 'confirmTrigger' ActionIntents
 *
 * 'actionPrompt': Shows role action prompt dialog with schema-driven text,
 * including witch compound info, confirm kind prompts, and UI hint overrides.
 * 'confirmTrigger': Shows hunter/darkWolfKing shoot-status dialog, then submits
 * confirmed action via proceedWithAction.
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const actionPromptExecutor: IntentExecutor = (_intent, ctx) => {
  const { gameState, effectiveRole, currentSchema, currentActionRole, actionDialogs } = ctx;

  const hint = gameState?.ui?.currentActorHint;
  const hintApplies = hint && effectiveRole && hint.targetRoleIds.includes(effectiveRole);
  roomScreenLog.debug('[actionPrompt] UI Hint check', {
    hint: hint
      ? {
          kind: hint.kind,
          targetRoleIds: hint.targetRoleIds,
          bottomAction: hint.bottomAction,
        }
      : null,
    effectiveRole,
    hintApplies,
    'gameState.ui': gameState?.ui,
  });
  if (hintApplies && hint.promptOverride) {
    actionDialogs.showRoleActionPrompt(
      hint.promptOverride.title!,
      hint.promptOverride.text!,
      () => {},
    );
    return;
  }

  if (currentSchema?.kind === 'compound' && currentSchema.id === 'witchAction') {
    const witchCtx = gameState?.witchContext;
    if (!witchCtx) return;
    actionDialogs.showWitchInfoPrompt(witchCtx, currentSchema, () => {});
    return;
  }

  if (currentSchema?.kind === 'confirm') {
    if (!currentSchema.ui?.prompt) {
      throw new Error(
        `[FAIL-FAST] Missing schema.ui.prompt for confirm schema: ${currentActionRole}`,
      );
    }
    const confirmTitle = currentActionRole
      ? `${getRoleDisplayName(currentActionRole)}行动`
      : '夜间行动';
    actionDialogs.showRoleActionPrompt(confirmTitle, currentSchema.ui.prompt, () => {});
    return;
  }

  if (!currentSchema?.ui?.prompt) {
    throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
  }
  const title = currentActionRole ? `${getRoleDisplayName(currentActionRole)}行动` : '夜间行动';
  actionDialogs.showRoleActionPrompt(title, currentSchema.ui.prompt, () => {});
};

export const confirmTriggerExecutor: IntentExecutor = (_intent, ctx) => {
  const {
    gameState,
    effectiveRole,
    effectiveSeat,
    currentSchema,
    proceedWithAction,
    actionDialogs,
  } = ctx;

  if (!gameState) return;

  if (
    !currentSchema?.ui?.statusDialogTitle ||
    !currentSchema?.ui?.canShootText ||
    !currentSchema?.ui?.cannotShootText
  ) {
    throw new Error(
      `[RoomScreen] confirmTrigger schema missing status dialog UI fields for ${currentSchema?.id}`,
    );
  }

  const confirmStatus = gameState.confirmStatus;
  let canShoot = true;

  if (effectiveRole === 'hunter') {
    if (confirmStatus?.role === 'hunter') {
      canShoot = confirmStatus.canShoot;
    }
  } else if (effectiveRole === 'darkWolfKing') {
    if (confirmStatus?.role === 'darkWolfKing') {
      canShoot = confirmStatus.canShoot;
    }
  }

  const dialogTitle = currentSchema.ui.statusDialogTitle;
  const statusMessage = canShoot ? currentSchema.ui.canShootText : currentSchema.ui.cannotShootText;

  if (effectiveSeat === null) {
    roomScreenLog.warn(
      '[confirmTrigger] Cannot submit confirm action without seat (effectiveSeat is null)',
    );
    return;
  }
  actionDialogs.showRoleActionPrompt(
    dialogTitle,
    statusMessage,
    () => void proceedWithAction(effectiveSeat, { confirmed: true }),
  );
};

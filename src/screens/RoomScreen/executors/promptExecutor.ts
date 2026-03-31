/**
 * promptExecutor — Handles 'actionPrompt' and 'confirmTrigger' ActionIntents
 *
 * 'actionPrompt': Shows role action prompt dialog with schema-driven text,
 * including witch compound info, confirm kind prompts, and UI hint overrides.
 * 'confirmTrigger': Shows hunter/darkWolfKing shoot-status dialog, then submits
 * confirmed action via proceedWithAction.
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';

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
  const promptText =
    hintApplies && hint.message
      ? `${currentSchema.ui.prompt}\n\n⚠️ ${hint.message}`
      : currentSchema.ui.prompt;
  actionDialogs.showRoleActionPrompt(title, promptText, () => {});
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

  const statusUi = currentSchema?.ui?.confirmStatusUi;
  if (!statusUi) {
    throw new Error(
      `[RoomScreen] confirmTrigger schema missing confirmStatusUi for ${currentSchema?.id}`,
    );
  }

  const confirmStatus = gameState.confirmStatus;
  const dialogTitle = statusUi.statusDialogTitle;
  let statusMessage: string;

  if (statusUi.kind === 'faction') {
    // Avenger: 3-way faction display
    const faction = confirmStatus?.role === 'avenger' ? confirmStatus.faction : Team.Good;
    statusMessage =
      faction === Team.Third
        ? statusUi.bondedText
        : faction === Team.Wolf
          ? statusUi.wolfText
          : statusUi.goodText;
  } else {
    // Hunter / DarkWolfKing: 2-way shoot status
    let canShoot = true;
    if (confirmStatus && confirmStatus.role !== 'avenger' && confirmStatus.role === effectiveRole) {
      canShoot = confirmStatus.canShoot;
    }
    statusMessage = canShoot ? statusUi.canText : statusUi.cannotText;
  }

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

/**
 * useRoomActionDialogs - Pure UI dialog layer for action phase
 *
 * Only responsible for "how to display" dialogs.
 * Does NOT contain business rules or decide "when to display".
 * All onConfirm callbacks are provided by the caller (RoomScreen orchestrator).
 * Calls showAlert, formats messages, and collects user input. Does not import
 * services, does not contain business rules, and does not hold execution functions.
 */

import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import { useCallback } from 'react';

import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

/**
 * Witch context for UI display (simplified from WitchContextPayload).
 * Does not require 'kind' discriminator since it's read from gameState.
 */
interface WitchContext {
  /** Seat killed by wolves (-1 = empty kill) */
  killedSeat: number;
  /** Whether witch can save (Server already checked: not self, has antidote) */
  canSave: boolean;
  /** Whether witch has poison available */
  canPoison: boolean;
}

export interface UseRoomActionDialogsResult {
  /**
   * Action rejected alert - displays when server rejects an action.
   * @param reason - Human-readable reason from ACTION_REJECTED payload
   */
  showActionRejectedAlert: (reason: string) => void;

  /** Magician first target alert (schema-driven). */
  showMagicianFirstAlert: (seat: number, schema: ActionSchema) => void;

  /** Reveal dialog (seer/psychic) */
  showRevealDialog: (title: string, message: string, onConfirm: () => void) => void;

  /** Generic confirm dialog */
  showConfirmDialog: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ) => void;

  /** Wolf vote dialog (schema-driven). */
  showWolfVoteDialog: (
    wolfName: string,
    targetSeat: number, // -1 = empty knife
    onConfirm: () => void,
    messageOverride: string | undefined,
    schema: ActionSchema,
  ) => void;

  /**
   * Witch info prompt (schema-driven): dynamic info comes from WitchContext;
   * template copy comes from currentSchema.
   */
  showWitchInfoPrompt: (
    ctx: WitchContext,
    currentSchema: ActionSchema,
    onDismiss: () => void,
  ) => void;

  /** Generic role action prompt (e.g., "请预言家行动") */
  showRoleActionPrompt: (
    roleName: string,
    actionMessage: string,
    onDismiss: () => void,
    buttonLabel?: string,
  ) => void;
}

export function useRoomActionDialogs(): UseRoomActionDialogsResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Action rejected alert (unified UX for server rejections)
  // ─────────────────────────────────────────────────────────────────────────

  const showActionRejectedAlert = useCallback((reason: string) => {
    showDismissAlert('操作无效', reason);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Magician first target
  // ─────────────────────────────────────────────────────────────────────────

  const showMagicianFirstAlert = useCallback((seat: number, schema: ActionSchema) => {
    const title = schema.ui!.firstTargetTitle!;
    const body = schema.ui!.firstTargetPromptTemplate!.replace('{seat}', formatSeat(seat));
    showDismissAlert(title, body);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Reveal dialog (seer/psychic)
  // ─────────────────────────────────────────────────────────────────────────

  const showRevealDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    showDismissAlert(title, message, onConfirm);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Generic confirm dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showConfirmDialog = useCallback(
    (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      showConfirmAlert(title, message, onConfirm, onCancel ? { onCancel } : undefined);
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showWolfVoteDialog = useCallback(
    (
      wolfName: string,
      targetSeat: number,
      onConfirm: () => void,
      messageOverride: string | undefined,
      schema: ActionSchema,
    ) => {
      const title = schema.ui!.confirmTitle!;
      let msg: string;
      if (messageOverride) {
        msg = messageOverride;
      } else if (targetSeat === -1) {
        msg = schema.ui!.emptyVoteConfirmTemplate!.replace('{wolf}', wolfName);
      } else {
        msg = schema
          .ui!.voteConfirmTemplate!.replace('{wolf}', wolfName)
          .replace('{seat}', formatSeat(targetSeat));
      }

      showConfirmAlert(title, msg, onConfirm);
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Witch info prompt (schema-driven)
  // ─────────────────────────────────────────────────────────────────────────

  const showWitchInfoPrompt = useCallback(
    (ctx: WitchContext, currentSchema: ActionSchema, onDismiss: () => void) => {
      // Schema-driven: all text comes from schema steps.
      const saveStep =
        currentSchema.kind === 'compound'
          ? currentSchema.steps?.find((s) => s.key === 'save')
          : undefined;
      const poisonPrompt =
        currentSchema.kind === 'compound'
          ? currentSchema.steps?.find((s) => s.key === 'poison')?.ui?.prompt
          : undefined;

      const title = currentSchema.ui!.prompt!;

      // Three scenarios (all schema-driven):
      // 1. killedSeat >= 0 && canSave=true  → promptTemplate: "{seat}号被狼人袭击，是否使用解药？"
      // 2. killedSeat >= 0 && canSave=false → cannotSavePrompt: "你被狼人袭击…"
      // 3. killedSeat < 0                   → poisonPrompt: "如要使用毒药，请点击座位。"
      if (ctx.killedSeat >= 0) {
        if (ctx.canSave) {
          const msg = saveStep!.ui!.promptTemplate!.replace('{seat}', formatSeat(ctx.killedSeat));
          showDismissAlert(title, msg, onDismiss);
        } else {
          showDismissAlert(title, saveStep!.ui!.cannotSavePrompt!, onDismiss);
        }
        return;
      }

      // Empty kill (killedSeat < 0)
      showDismissAlert(currentSchema.ui!.emptyKillTitle!, poisonPrompt!, onDismiss);
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Generic role action prompt
  // ─────────────────────────────────────────────────────────────────────────

  const showRoleActionPrompt = useCallback(
    (title: string, actionMessage: string, onDismiss: () => void, buttonLabel?: string) => {
      showAlert(title, actionMessage, [
        { text: buttonLabel ?? '知道了', style: 'default', onPress: onDismiss },
      ]);
    },
    [],
  );

  return {
    showActionRejectedAlert,
    showMagicianFirstAlert,
    showRevealDialog,
    showConfirmDialog,
    showWolfVoteDialog,
    showWitchInfoPrompt,
    showRoleActionPrompt,
  };
}

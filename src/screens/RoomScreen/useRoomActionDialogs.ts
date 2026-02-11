/**
 * useRoomActionDialogs - Pure UI dialog layer for action phase
 *
 * Only responsible for "how to display" dialogs.
 * Does NOT contain business rules or decide "when to display".
 * All onConfirm callbacks are provided by the caller (RoomScreen orchestrator).
 *
 * ❌ Do NOT: import services, contain business rules, hold execution functions
 * ✅ Allowed: call showAlert, format messages, collect user input
 */

import { useCallback } from 'react';

import type { ActionSchema } from '@/models/roles/spec';
import { showAlert } from '@/utils/alert';

/**
 * Witch context for UI display (simplified from WitchContextPayload).
 * Does not require 'kind' discriminator since it's read from gameState.
 */
interface WitchContext {
  /** Seat killed by wolves (-1 = empty kill) */
  killedSeat: number;
  /** Whether witch can save (Host already checked: not self, has antidote) */
  canSave: boolean;
  /** Whether witch has poison available */
  canPoison: boolean;
}

export interface UseRoomActionDialogsResult {
  /**
   * Action rejected alert - displays when Host rejects an action.
   * @param reason - Human-readable reason from ACTION_REJECTED payload
   */
  showActionRejectedAlert: (reason: string) => void;

  /** Magician first target alert (schema-driven when schema provided) */
  showMagicianFirstAlert: (index: number, schema?: ActionSchema) => void;

  /** Reveal dialog (seer/psychic) */
  showRevealDialog: (title: string, message: string, onConfirm: () => void) => void;

  /** Generic confirm dialog */
  showConfirmDialog: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ) => void;

  /** Wolf vote dialog (schema-driven when schema provided) */
  showWolfVoteDialog: (
    wolfName: string,
    targetIndex: number, // -1 = empty knife
    onConfirm: () => void,
    messageOverride?: string,
    schema?: ActionSchema,
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
  showRoleActionPrompt: (roleName: string, actionMessage: string, onDismiss: () => void) => void;
}

export function useRoomActionDialogs(): UseRoomActionDialogsResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Action rejected alert (unified UX for Host rejections)
  // ─────────────────────────────────────────────────────────────────────────

  const showActionRejectedAlert = useCallback((reason: string) => {
    showAlert('操作无效', reason, [{ text: '知道了', style: 'default' }]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Magician first target
  // ─────────────────────────────────────────────────────────────────────────

  const showMagicianFirstAlert = useCallback((index: number, schema?: ActionSchema) => {
    const title = schema?.ui?.firstTargetTitle ?? '已选择第一位玩家';
    const tpl = schema?.ui?.firstTargetPromptTemplate ?? '{seat}号，请选择第二位玩家';
    const msg = tpl.replace('{seat}', `${index + 1}`);
    showAlert(title, msg, [{ text: '知道了', style: 'default' }]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Reveal dialog (seer/psychic)
  // ─────────────────────────────────────────────────────────────────────────

  const showRevealDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    showAlert(title, message, [{ text: '知道了', onPress: onConfirm }]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Generic confirm dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showConfirmDialog = useCallback(
    (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      showAlert(title, message, [
        { text: '取消', style: 'cancel', onPress: onCancel },
        { text: '确定', onPress: onConfirm },
      ]);
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showWolfVoteDialog = useCallback(
    (
      wolfName: string,
      targetIndex: number,
      onConfirm: () => void,
      messageOverride?: string,
      schema?: ActionSchema,
    ) => {
      const title = schema?.ui?.confirmTitle ?? '狼人投票';
      let msg: string;
      if (messageOverride) {
        msg = messageOverride;
      } else if (targetIndex === -1) {
        const tpl = schema?.ui?.emptyVoteConfirmTemplate ?? '{wolf} 确定投票空刀吗？';
        msg = tpl.replace('{wolf}', wolfName);
      } else {
        const tpl = schema?.ui?.voteConfirmTemplate ?? '{wolf} 确定要猎杀{seat}号玩家吗？';
        msg = tpl.replace('{wolf}', wolfName).replace('{seat}', `${targetIndex + 1}`);
      }

      showAlert(title, msg, [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: onConfirm },
      ]);
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

      const rolePrompt = currentSchema.ui?.prompt || '女巫请行动';
      const title = rolePrompt;
      const dismiss = [{ text: '知道了', style: 'default' as const, onPress: onDismiss }];

      // Three scenarios (all schema-driven):
      // 1. killedSeat >= 0 && canSave=true  → promptTemplate: "{seat}号被狼人杀了，是否使用解药？"
      // 2. killedSeat >= 0 && canSave=false → cannotSavePrompt: "你被狼人杀了…"
      // 3. killedSeat < 0                   → poisonPrompt: "如要使用毒药，请点击座位。"
      if (ctx.killedSeat >= 0) {
        if (ctx.canSave && saveStep?.ui?.promptTemplate) {
          const msg = saveStep.ui.promptTemplate.replace('{seat}', `${ctx.killedSeat + 1}`);
          showAlert(title, msg, dismiss);
        } else if (!ctx.canSave && saveStep?.ui?.cannotSavePrompt) {
          showAlert(title, saveStep.ui.cannotSavePrompt, dismiss);
        } else {
          // Fallback: should not happen with correct schema, but defensive.
          showAlert(title, poisonPrompt || rolePrompt, dismiss);
        }
        return;
      }

      // Empty kill (killedSeat < 0)
      const emptyKillTitle = currentSchema.ui?.emptyKillTitle ?? '昨夜无人倒台';
      showAlert(emptyKillTitle, poisonPrompt || rolePrompt, dismiss);
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Generic role action prompt
  // ─────────────────────────────────────────────────────────────────────────

  const showRoleActionPrompt = useCallback(
    (title: string, actionMessage: string, onDismiss: () => void) => {
      showAlert(title, actionMessage, [{ text: '知道了', style: 'default', onPress: onDismiss }]);
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

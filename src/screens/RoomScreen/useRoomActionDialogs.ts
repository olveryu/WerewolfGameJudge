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
import { showAlert } from '../../utils/alert';
import type { ActionSchema } from '../../models/roles/spec';
import { BLOCKED_UI_DEFAULTS } from '../../models/roles/spec';
import type { WitchContextPayload } from '../../services/types/PrivateBroadcast';

export interface UseRoomActionDialogsResult {
  /** 
   * Action rejected alert - displays when Host rejects an action.
   * @param reason - Human-readable reason from ACTION_REJECTED payload
   */
  showActionRejectedAlert: (reason: string) => void;

  /** Blocked alert - displays when nightmare-blocked player taps a seat */
  showBlockedAlert: () => void;

  /** Magician first target alert */
  showMagicianFirstAlert: (index: number) => void;

  /** Reveal dialog (seer/psychic) */
  showRevealDialog: (
    title: string,
    message: string,
    onConfirm: () => void
  ) => void;

  /** Generic confirm dialog */
  showConfirmDialog: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;

  /** Wolf vote dialog */
  showWolfVoteDialog: (
    wolfName: string,
    targetIndex: number, // -1 = empty knife
  onConfirm: () => void,
  messageOverride?: string
  ) => void;

  /** Witch save phase dialog */
  showWitchSaveDialog: (
    killedIndex: number, // -1 = no one killed
    canSave: boolean,
    onSave: () => void,
    onSkip: () => void
  ) => void;

  /** Witch poison phase prompt */
  showWitchPoisonPrompt: (onDismiss: () => void) => void;

  /** Witch poison confirm dialog */
  showWitchPoisonConfirm: (
    targetIndex: number,
    onConfirm: () => void,
    onCancel: () => void
  ) => void;

  /**
   * Witch info prompt (schema-driven): dynamic info comes from WitchContextPayload;
   * template copy comes from currentSchema.
   */
  showWitchInfoPrompt: (
    ctx: WitchContextPayload,
    currentSchema: ActionSchema,
    onDismiss: () => void
  ) => void;

  /** Generic role action prompt (e.g., "请预言家行动") */
  showRoleActionPrompt: (
    roleName: string,
    actionMessage: string,
    onDismiss: () => void
  ) => void;
}

export function useRoomActionDialogs(): UseRoomActionDialogsResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Action rejected alert (unified UX for Host rejections)
  // ─────────────────────────────────────────────────────────────────────────

  const showActionRejectedAlert = useCallback((reason: string) => {
    showAlert('操作无效', reason, [{ text: '知道了', style: 'default' }]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Blocked alert (nightmare block feedback)
  // ─────────────────────────────────────────────────────────────────────────

  const showBlockedAlert = useCallback(() => {
    showAlert(
      BLOCKED_UI_DEFAULTS.title,
      BLOCKED_UI_DEFAULTS.message,
      [{ text: BLOCKED_UI_DEFAULTS.dismissButtonText, style: 'default' }]
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Magician first target
  // ─────────────────────────────────────────────────────────────────────────

  const showMagicianFirstAlert = useCallback((index: number) => {
    showAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`, [{ text: '知道了', style: 'default' }]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Reveal dialog (seer/psychic)
  // ─────────────────────────────────────────────────────────────────────────

  const showRevealDialog = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      showAlert(title, message, [{ text: '知道了', onPress: onConfirm }]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Generic confirm dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showConfirmDialog = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void
    ) => {
      showAlert(title, message, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showWolfVoteDialog = useCallback(
    (
      wolfName: string,
      targetIndex: number,
      onConfirm: () => void,
      messageOverride?: string
    ) => {
      const msg =
        messageOverride ||
        (targetIndex === -1
          ? `${wolfName} 确定投票空刀吗？`
          : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`);

      showAlert('狼人投票', msg, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel' },
      ]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Witch save phase dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showWitchSaveDialog = useCallback(
    (
      killedIndex: number,
      canSave: boolean,
      onSave: () => void,
      onSkip: () => void
    ) => {
      if (killedIndex === -1) {
        // No one killed - info prompt
        showAlert('昨夜无人倒台', '', [{ text: '知道了', onPress: onSkip }]);
        return;
      }

      if (!canSave) {
        // Cannot save (self killed) - info prompt
        showAlert(
          `昨夜倒台玩家为${killedIndex + 1}号（你自己）`,
          '女巫无法自救',
          [{ text: '知道了', onPress: onSkip }]
        );
        return;
      }

      // Can save - choice dialog
      showAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', [
        { text: '确定', onPress: onSave },
        { text: '取消', style: 'cancel', onPress: onSkip },
      ]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Witch poison phase prompt
  // ─────────────────────────────────────────────────────────────────────────

  const showWitchPoisonPrompt = useCallback((onDismiss: () => void) => {
    showAlert(
      '请选择是否使用毒药',
      '点击玩家头像使用毒药，如不使用毒药，请点击下方「不使用技能」',
      [{ text: '知道了', style: 'default', onPress: onDismiss }]
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Witch poison confirm dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showWitchPoisonConfirm = useCallback(
    (targetIndex: number, onConfirm: () => void, onCancel: () => void) => {
      showAlert(`确定要毒杀${targetIndex + 1}号玩家吗？`, '', [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Witch info prompt (schema-driven)
  // ─────────────────────────────────────────────────────────────────────────

  const showWitchInfoPrompt = useCallback(
    (ctx: WitchContextPayload, currentSchema: ActionSchema, onDismiss: () => void) => {
      // Static template copy must come from schema.
      const rolePrompt = currentSchema.ui?.prompt || '女巫请行动';

      // Prefer poison prompt (as it matches “毒药请选择号码”) but keep schema-driven.
      const poisonPrompt =
        currentSchema.kind === 'compound'
          ? currentSchema.steps?.find((s) => s.key === 'poison')?.ui?.prompt
          : undefined;

      const hint = poisonPrompt || rolePrompt;

      const title = ctx.killedIndex >= 0 ? `昨夜${ctx.killedIndex + 1}号玩家死亡` : '昨夜无人倒台';
      showAlert(title, hint, [{ text: '知道了', style: 'default', onPress: onDismiss }]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Generic role action prompt
  // ─────────────────────────────────────────────────────────────────────────

  const showRoleActionPrompt = useCallback(
    (title: string, actionMessage: string, onDismiss: () => void) => {
      showAlert(title, actionMessage, [
        { text: '知道了', style: 'default', onPress: onDismiss },
      ]);
    },
    []
  );

  return {
    showActionRejectedAlert,
    showBlockedAlert,
    showMagicianFirstAlert,
    showRevealDialog,
    showConfirmDialog,
    showWolfVoteDialog,
    showWitchSaveDialog,
    showWitchPoisonPrompt,
    showWitchPoisonConfirm,
  showWitchInfoPrompt,
    showRoleActionPrompt,
  };
}

export default useRoomActionDialogs;

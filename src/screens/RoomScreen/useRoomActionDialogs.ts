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

export interface UseRoomActionDialogsResult {
  /** Nightmare blocked alert */
  showBlockedAlert: () => void;

  /** Magician first target alert */
  showMagicianFirstAlert: (index: number) => void;

  /** Reveal dialog (seer/psychic) */
  showRevealDialog: (
    title: string,
    message: string,
    onConfirm: () => void
  ) => void;

  /** Status dialog (hunter/darkWolfKing) */
  showStatusDialog: (
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
    onConfirm: () => void
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

  /** Generic role action prompt (e.g., "请预言家行动") */
  showRoleActionPrompt: (
    roleName: string,
    actionMessage: string,
    onDismiss: () => void
  ) => void;
}

export function useRoomActionDialogs(): UseRoomActionDialogsResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Blocked alert
  // ─────────────────────────────────────────────────────────────────────────

  const showBlockedAlert = useCallback(() => {
    showAlert(
      '技能被封锁',
      '你被梦魇恐惧，今晚无法使用技能。\n请点击"跳过"按钮。'
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Magician first target
  // ─────────────────────────────────────────────────────────────────────────

  const showMagicianFirstAlert = useCallback((index: number) => {
    showAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Reveal dialog (seer/psychic)
  // ─────────────────────────────────────────────────────────────────────────

  const showRevealDialog = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      showAlert(title, message, [{ text: '确定', onPress: onConfirm }]);
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Status dialog (hunter/darkWolfKing)
  // ─────────────────────────────────────────────────────────────────────────

  const showStatusDialog = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      showAlert(title, message, [{ text: '确定', onPress: onConfirm }]);
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
    (wolfName: string, targetIndex: number, onConfirm: () => void) => {
      const msg =
        targetIndex === -1
          ? `${wolfName} 确定投票空刀吗？`
          : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`;

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
        // No one killed
        showAlert('昨夜无人倒台', '', [{ text: '好', onPress: onSkip }]);
        return;
      }

      if (!canSave) {
        // Cannot save (self killed)
        showAlert(
          `昨夜倒台玩家为${killedIndex + 1}号（你自己）`,
          '女巫无法自救',
          [{ text: '好', onPress: onSkip }]
        );
        return;
      }

      // Can save
      showAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', [
        { text: '救助', onPress: onSave },
        { text: '不救助', style: 'cancel', onPress: onSkip },
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
      [{ text: '好', style: 'default', onPress: onDismiss }]
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
  // Generic role action prompt
  // ─────────────────────────────────────────────────────────────────────────

  const showRoleActionPrompt = useCallback(
    (title: string, actionMessage: string, onDismiss: () => void) => {
      showAlert(title, actionMessage, [
        { text: '好', style: 'default', onPress: onDismiss },
      ]);
    },
    []
  );

  return {
    showBlockedAlert,
    showMagicianFirstAlert,
    showRevealDialog,
    showStatusDialog,
    showConfirmDialog,
    showWolfVoteDialog,
    showWitchSaveDialog,
    showWitchPoisonPrompt,
    showWitchPoisonConfirm,
    showRoleActionPrompt,
  };
}

export default useRoomActionDialogs;

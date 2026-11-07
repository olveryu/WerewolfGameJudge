/**
 * useRoomModals — the Werewolf room's own dialogs around the shared review.
 *
 * Owns: the seat picker through which the host grants seats access to the
 * review （授权玩家查看）, and the last-night-info confirm → info → curse
 * chain. The review itself — its confirmation, dialog and image share — is
 * the shared `useRoomReview`; identity viewing is the shared
 * `useRoleViewing`; skill preview is screen-local state.
 */

import { useCallback, useState } from 'react';

import { DISMISS_BUTTON, showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

interface UseRoomModalsDeps {
  /** The game the dialogs belong to; a new game closes the grant picker. */
  readonly gameSequence: number;
  /** Get last-night info text */
  readonly getLastNightInfo: () => string;
  /** Get crow curse info; null if no crow */
  readonly getCurseInfo: () => string | null;
  /** Grants the seats access to the review; resolves true when committed. */
  readonly grantReviewAccess: (allowedSeats: readonly number[]) => Promise<boolean>;
  /**
   * Whether the game has ended. Confirmation copy only warns about the
   * sheriff election while an election can still be affected; at Ended
   * that warning is meaningless and drops out.
   */
  readonly isGameEnded: boolean;
  /**
   * Fired when the viewer confirms viewing the last-night info in its
   * dialog — the panel flow's first step completes on this confirm,
   * not on merely opening the dialog.
   */
  readonly onLastNightInfoConfirmed: () => void;
}

interface RoomModalsState {
  readonly isGrantVisible: boolean;
  readonly openGrant: () => void;
  readonly closeGrant: () => void;
  readonly grantSeatsAccess: (allowedSeats: readonly number[]) => Promise<void>;
  readonly showLastNightInfo: () => void;
}

export function useRoomModals({
  gameSequence,
  getLastNightInfo,
  getCurseInfo,
  grantReviewAccess,
  isGameEnded,
  onLastNightInfoConfirmed,
}: UseRoomModalsDeps): RoomModalsState {
  // The picker belongs to the game it opened in; the sequence only grows,
  // so a new game hides it without a reset.
  const [grantGameSequence, setGrantGameSequence] = useState<number | null>(null);
  const isGrantVisible = grantGameSequence === gameSequence;

  const openGrant = useCallback(() => setGrantGameSequence(gameSequence), [gameSequence]);
  const closeGrant = useCallback(() => setGrantGameSequence(null), []);

  const grantSeatsAccess = useCallback(
    async (allowedSeats: readonly number[]) => {
      const requestedFor = gameSequence;
      const isCommitted = await grantReviewAccess(allowedSeats);
      if (isCommitted) {
        setGrantGameSequence((current) => (current === requestedFor ? null : current));
      }
    },
    [gameSequence, grantReviewAccess],
  );

  const showLastNightInfo = useCallback(() => {
    showConfirmAlert(
      '提示',
      isGameEnded
        ? '请确认是否现在查看昨夜信息。'
        : '昨夜信息可能影响警长竞选，请确认是否现在查看。',
      () => {
        onLastNightInfoConfirmed();
        const info = getLastNightInfo();
        const curseInfo = getCurseInfo();
        const buttons: {
          text: string;
          onPress?: () => void;
          style?: 'default' | 'cancel' | 'destructive';
        }[] = [DISMISS_BUTTON];
        if (curseInfo != null) {
          buttons.unshift({
            text: '查看诅咒',
            onPress: () => {
              showDismissAlert('乌鸦诅咒', curseInfo);
            },
          });
        }
        showAlert('昨夜信息', info, buttons);
      },
      { confirmText: '确定查看' },
    );
  }, [getLastNightInfo, getCurseInfo, isGameEnded, onLastNightInfoConfirmed]);

  return { isGrantVisible, openGrant, closeGrant, grantSeatsAccess, showLastNightInfo };
}

/**
 * useRoomModals — the Werewolf room's own dialogs around the shared review.
 *
 * Owns: the seat picker through which the host grants seats access to the
 * review （授权玩家查看） and the last-night information dialogs.
 * The review itself — its confirmation, dialog and image share — is
 * the shared `useRoomReview`; identity viewing is the shared
 * `useRoleViewing`; skill preview is screen-local state.
 */

import type { WerewolfDaytimeAnnouncement } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useState } from 'react';

import { confirmView } from '@/features/room/confirm';
import { showDismissAlert } from '@/utils/alertPresets';

interface UseRoomModalsDeps {
  /** The game the dialogs belong to; a new game closes the grant picker. */
  readonly gameSequence: number;
  /** Get last-night info text */
  readonly getLastNightInfo: () => string;
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
  readonly onLastNightInfoConfirmed: () => Promise<boolean>;
}

interface RoomModalsState {
  readonly isGrantVisible: boolean;
  readonly openGrant: () => void;
  readonly closeGrant: () => void;
  readonly grantSeatsAccess: (allowedSeats: readonly number[]) => Promise<void>;
  readonly showLastNightInfo: (label?: string) => void;
  readonly showAnnouncement: (announcement: WerewolfDaytimeAnnouncement) => void;
}

export function useRoomModals({
  gameSequence,
  getLastNightInfo,
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

  const showLastNightInfo = useCallback(
    (label = '查看昨夜信息') => {
      confirmView({
        label,
        body: isGameEnded ? undefined : '昨夜信息可能影响警长竞选。',
        onView: () => {
          showDismissAlert('昨夜信息', getLastNightInfo(), async () => {
            await onLastNightInfoConfirmed();
          });
        },
      });
    },
    [getLastNightInfo, isGameEnded, onLastNightInfoConfirmed],
  );

  const showAnnouncement = useCallback((announcement: WerewolfDaytimeAnnouncement) => {
    confirmView({
      label: `查看${announcement.title}`,
      onView: () => showDismissAlert(announcement.title, announcement.message),
    });
  }, []);

  return {
    isGrantVisible,
    openGrant,
    closeGrant,
    grantSeatsAccess,
    showLastNightInfo,
    showAnnouncement,
  };
}

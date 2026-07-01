/**
 * usePlayerProfileController — shared PlayerProfileCard target state.
 */
import { useCallback, useMemo, useState } from 'react';

export interface PlayerProfileTarget {
  seat: number;
  userId: string;
  displayName: string;
  isSelf: boolean;
}

interface UsePlayerProfileControllerParams {
  myUserId: string | null;
  getDisplayName: (seat: number, userId: string) => string;
  onKickSeat: (seat: number) => void;
  onLeaveSeat: (seat: number) => void;
}

export function usePlayerProfileController({
  myUserId,
  getDisplayName,
  onKickSeat,
  onLeaveSeat,
}: UsePlayerProfileControllerParams) {
  const [target, setTarget] = useState<PlayerProfileTarget | null>(null);

  const closeProfile = useCallback(() => {
    setTarget(null);
  }, []);

  const openProfile = useCallback(
    (seat: number, userId: string): void => {
      setTarget({
        seat,
        userId,
        displayName: getDisplayName(seat, userId),
        isSelf: userId === myUserId,
      });
    },
    [getDisplayName, myUserId],
  );

  const handleKick = useCallback(
    (seat: number): void => {
      setTarget(null);
      onKickSeat(seat);
    },
    [onKickSeat],
  );

  const handleLeaveSeat = useCallback(
    (seat: number): void => {
      setTarget(null);
      onLeaveSeat(seat);
    },
    [onLeaveSeat],
  );

  return useMemo(
    () => ({
      target,
      openProfile,
      closeProfile,
      handleKick,
      handleLeaveSeat,
    }),
    [closeProfile, handleKick, handleLeaveSeat, openProfile, target],
  );
}

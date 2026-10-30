/**
 * useRoleViewing — the identity-viewing protocol every game runs.
 *
 * Werewolf's behavior, promoted: the first view submits `role.viewed`
 * first and opens the card only after the server confirmed it; a
 * rejection shows the failure message and opens nothing. The card's
 * reveal facts are frozen at open from the pre-confirm server record —
 * `shouldPlayAnimation` (first view of this seat) and `remainingCards`
 * (cards still face-down on the table, the viewer's own included) — so
 * the record landing underneath never flips the animation off or pulls
 * the viewer's own card from the table mid-reveal. A seat already on
 * record opens immediately, without animation or a second submit.
 *
 * `isPending` is the in-flight window between submit and confirmation,
 * for the button's loading state. A change of the effective seat (bot
 * takeover switch) closes the card: a frozen reveal belongs to one seat.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { deriveRemainingRevealCards } from '../model/RevealRoleData';

export interface RoleViewingOptions {
  /** The seat whose identity is viewed (own or controlled bot seat); null while unseated. */
  readonly effectiveSeat: number | null;
  /** Whether the server already records a view for the effective seat. */
  readonly hasViewed: boolean;
  readonly occupiedSeatCount: number;
  /** Seats whose view is on the server record. */
  readonly viewedSeatCount: number;
  /**
   * Submit `role.viewed` for the effective seat; resolves true only on a
   * committed success and never throws (failures are presented by the
   * submission itself, as `useReadyRoomSession.submit` does).
   */
  readonly submitViewed: () => Promise<boolean>;
}

export interface RoleViewing {
  readonly isOpen: boolean;
  /** True between submit and server confirmation. */
  readonly isPending: boolean;
  /** Frozen at open: play the first-view animation. */
  readonly shouldPlayAnimation: boolean;
  /** Frozen at open: cards still face-down for the reveal effect. */
  readonly remainingCards: number;
  readonly open: () => void;
  readonly close: () => void;
}

interface OpenCard {
  readonly shouldPlayAnimation: boolean;
  readonly remainingCards: number;
}

export function useRoleViewing({
  effectiveSeat,
  hasViewed,
  occupiedSeatCount,
  viewedSeatCount,
  submitViewed,
}: RoleViewingOptions): RoleViewing {
  const [card, setCard] = useState<OpenCard | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Identity of the in-flight open; a seat change or close abandons it.
  const runRef = useRef(0);

  const close = useCallback(() => {
    runRef.current += 1;
    setCard(null);
    setIsPending(false);
  }, []);

  useEffect(() => {
    close();
  }, [close, effectiveSeat]);

  const open = useCallback(() => {
    if (effectiveSeat === null) {
      throw new Error('[FAIL-FAST] Role viewing opened without an effective seat');
    }
    if (card !== null || isPending) {
      throw new Error('[FAIL-FAST] Role viewing opened while already open or pending');
    }
    const remainingCards = deriveRemainingRevealCards(occupiedSeatCount, viewedSeatCount);
    if (hasViewed) {
      setCard({ shouldPlayAnimation: false, remainingCards });
      return;
    }
    const run = runRef.current + 1;
    runRef.current = run;
    setIsPending(true);
    void submitViewed().then((confirmed) => {
      if (runRef.current !== run) return;
      setIsPending(false);
      if (confirmed) setCard({ shouldPlayAnimation: true, remainingCards });
    });
  }, [card, effectiveSeat, hasViewed, isPending, occupiedSeatCount, submitViewed, viewedSeatCount]);

  return {
    isOpen: card !== null,
    isPending,
    shouldPlayAnimation: card?.shouldPlayAnimation ?? false,
    remainingCards: card?.remainingCards ?? 0,
    open,
    close,
  };
}

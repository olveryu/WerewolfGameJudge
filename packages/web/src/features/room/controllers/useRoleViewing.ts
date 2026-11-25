/**
 * useRoleViewing — the identity-viewing protocol every game runs.
 *
 * The player explicitly chooses whether to reveal the card. First views are
 * recorded only after the player acknowledges the revealed identity. A seat
 * or deal change closes the card and invalidates pending callbacks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { confirmView } from '@/features/room/confirm';
import { log } from '@/utils/logger';

import { deriveRemainingRevealCards } from '../model/RevealRoleData';

const roleViewingLog = log.extend('RoleViewing');

export interface RoleViewingOptions {
  /** The seat whose identity is viewed (own or controlled bot seat); null while unseated. */
  readonly effectiveSeat: number | null;
  /**
   * Identity of the deal the card belongs to (game sequence / round id);
   * null while there is nothing to view. Any change closes the card.
   */
  readonly identityKey: string | number | null;
  /** Whether the server already records a view for the effective seat. */
  readonly hasViewed: boolean;
  readonly occupiedSeatCount: number;
  /** Seats whose view is on the server record. */
  readonly viewedSeatCount: number;
  /** Shared command lock; acknowledgement must wait for any active room operation. */
  readonly isSubmitting: boolean;
  /**
   * Submit `role.viewed` for the effective seat; resolves true only on a
   * committed success. Failures are presented by the submission itself
   * (`useReadyRoomSession.submit`). A concurrent command can still win the
   * race after the confirmation is enabled, so the single-flight rejection
   * is handled here and leaves the card available for retry.
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
  /** Disable acknowledgement while another room command owns the single-flight lock. */
  readonly isConfirmationDisabled: boolean;
  readonly open: () => void;
  readonly close: () => void;
}

interface OpenCard {
  readonly shouldPlayAnimation: boolean;
  readonly remainingCards: number;
}

/** View state of one scope (effective seat + deal); `run` identifies the in-flight open. */
interface ViewState {
  readonly scopeKey: string;
  readonly run: number;
  readonly card: OpenCard | null;
  readonly isPending: boolean;
}

export function useRoleViewing({
  effectiveSeat,
  identityKey,
  hasViewed,
  occupiedSeatCount,
  viewedSeatCount,
  isSubmitting,
  submitViewed,
}: RoleViewingOptions): RoleViewing {
  const scopeKey = `${effectiveSeat ?? '-'}/${identityKey ?? '-'}`;
  const [view, setView] = useState<ViewState>({
    scopeKey,
    run: 0,
    card: null,
    isPending: false,
  });
  // A new scope closes the card and abandons an in-flight open (adjusting state on a prop change).
  if (view.scopeKey !== scopeKey) {
    setView({ scopeKey, run: view.run + 1, card: null, isPending: false });
  }
  const current = view.scopeKey === scopeKey ? view : null;
  const card = current?.card ?? null;
  const isPending = current?.isPending ?? false;

  const latestScope = useRef(scopeKey);
  useEffect(() => {
    latestScope.current = scopeKey;
  }, [scopeKey]);

  const close = useCallback(() => {
    if (card === null || isPending || isSubmitting) return;
    if (hasViewed) {
      setView((previous) => ({ scopeKey, run: previous.run + 1, card: null, isPending: false }));
      return;
    }
    const run = view.run + 1;
    setView({ scopeKey, run, card, isPending: true });
    void submitViewed().then(
      (confirmed) => {
        setView((previous) =>
          previous.scopeKey !== scopeKey || previous.run !== run
            ? previous
            : { ...previous, card: confirmed ? null : previous.card, isPending: false },
        );
      },
      (error: unknown) => {
        roleViewingLog.warn('identity acknowledgement blocked by an active room command', {
          error,
          scopeKey,
        });
        toast.error('有操作正在处理中，请稍后确认身份。');
        setView((previous) =>
          previous.scopeKey !== scopeKey || previous.run !== run
            ? previous
            : { ...previous, isPending: false },
        );
      },
    );
  }, [card, hasViewed, isPending, isSubmitting, scopeKey, submitViewed, view.run]);

  const open = useCallback(() => {
    if (effectiveSeat === null) {
      throw new Error('[FAIL-FAST] Role viewing opened without an effective seat');
    }
    if (identityKey === null) {
      throw new Error('[FAIL-FAST] Role viewing opened without a viewable identity');
    }
    // A second tap while the card is open or the confirmation is in flight
    // is the same request already being served; it is not an error.
    if (card !== null || isPending || isSubmitting) return;
    confirmView({
      label: '查看身份',
      onView: () => {
        if (latestScope.current !== scopeKey) {
          toast.error('身份已变化，请重新查看。');
          return;
        }
        setView((previous) => ({
          ...previous,
          card: {
            shouldPlayAnimation: !hasViewed,
            remainingCards: deriveRemainingRevealCards(occupiedSeatCount, viewedSeatCount),
          },
        }));
      },
    });
  }, [
    card,
    effectiveSeat,
    hasViewed,
    identityKey,
    isPending,
    isSubmitting,
    occupiedSeatCount,
    scopeKey,
    viewedSeatCount,
  ]);

  return {
    isOpen: card !== null,
    isPending,
    shouldPlayAnimation: card?.shouldPlayAnimation ?? false,
    remainingCards: card?.remainingCards ?? 0,
    isConfirmationDisabled: isSubmitting || isPending,
    open,
    close,
  };
}

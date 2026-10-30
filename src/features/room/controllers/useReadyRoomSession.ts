/**
 * useReadyRoomSession — the authenticated, ready room session every game
 * room hook starts from.
 *
 * Reads the auth user and the link snapshot and fails fast when either
 * is missing: a room screen is mounted only behind `RoomEntryBoundary`,
 * which guarantees a ready session, so a non-ready snapshot here is a
 * programming error, never a state to render around. Returns the
 * authoritative state and revision plus `submit`, the single-flight
 * command submission (`useRoomCommandSubmission`) bound to this
 * session's `dispatch`.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback } from 'react';

import { useAuthContext, type User } from '@/contexts/AuthContext';
import type { DispatchOutcome, RoomLink } from '@/platform/realtime/types';

import { useRoomCommandSubmission } from './useRoomCommandSubmission';
import { useRoomLinkSnapshot } from './useRoomLinkSnapshot';

export interface ReadyRoomSession<TState extends BaseGameState<string>, TCommand extends object> {
  readonly user: User;
  readonly state: TState;
  readonly revision: number;
  readonly session: RoomLink<TState, TCommand>;
  /** True while a `submit` is in flight; a second `submit` meanwhile throws. */
  readonly isSubmitting: boolean;
  /**
   * Submit one public command through the shared single-flight lock:
   * a rejection shows the game's failure message, a transport error goes
   * through the error pipeline; resolves true only on a committed success.
   */
  readonly submit: (
    label: string,
    command: TCommand,
    controlledSeat?: number | null,
  ) => Promise<boolean>;
}

export function useReadyRoomSession<TState extends BaseGameState<string>, TCommand extends object>(
  session: RoomLink<TState, TCommand>,
  getFailureMessage: (result: DispatchOutcome<TState>) => string,
): ReadyRoomSession<TState, TCommand> {
  const { user } = useAuthContext();
  const snapshot = useRoomLinkSnapshot(session);
  const submission = useRoomCommandSubmission(getFailureMessage);
  const submit = useCallback(
    (label: string, command: TCommand, controlledSeat: number | null = null) =>
      submission.submit(label, () =>
        session.dispatch(command, { controlledSeat, label, durable: false }),
      ),
    [session, submission],
  );
  if (user === null) {
    throw new Error('[FAIL-FAST] Room session requires an authenticated user');
  }
  if (snapshot.phase !== 'ready') {
    throw new Error(`[FAIL-FAST] Room session is not ready: ${snapshot.phase}`);
  }
  return {
    user,
    state: snapshot.room.state,
    revision: snapshot.room.revision,
    session,
    isSubmitting: submission.isSubmitting,
    submit,
  };
}

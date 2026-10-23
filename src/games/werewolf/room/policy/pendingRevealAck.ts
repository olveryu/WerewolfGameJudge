/**
 * pendingRevealAck — State-driven derivation of the reveal ack this client owes.
 *
 * Mirrors the engine's ack-owner lookup (validateRevealAckActor in
 * packages/game-engine/src/games/werewolf/engine.ts): a pending reveal ack is
 * bound to the latest recorded action whose schemaId is listed in
 * `pendingRevealAcks`, and only that action's actor may send
 * `werewolf.reveal.ack` — the host cannot ack on anyone's behalf.
 *
 * The outcome path (revealExecutor) presents the reveal dialog from the
 * just-committed command snapshot. After a full-page reload that snapshot is
 * gone, so this derivation is the state-driven re-entry signal: when it names
 * the effective actor, the room screen re-presents the same dialog from live
 * room state. Derived from the raw GameState because the LocalGameState
 * projection drops the recorded actions' actor seats.
 *
 * Pure function — no hooks, no IO, no presentation timing (suppression while
 * audio / overlays are up lives in useActionOrchestrator).
 */

import type {
  GameState,
  RevealKind,
  SchemaId,
} from '@game-judge/game-engine/games/werewolf/public';
import { getSchema } from '@game-judge/game-engine/games/werewolf/public';

/** A reveal ack owed by one specific actor, derived from room state. */
export interface PendingRevealAck {
  /** Schema of the recorded action that produced the reveal (the engine's ack key). */
  readonly schemaId: SchemaId;
  /** Reveal kind declared by that schema's ui — the key of the reveal data in state. */
  readonly revealKind: RevealKind;
  /** Seat of the recorded action; the only seat the engine accepts the ack from. */
  readonly actorSeat: number;
}

/**
 * Derive the pending reveal ack owned by `actorSeat`.
 *
 * Returns null when no reveal ack is pending, when the pending ack's recorded
 * action belongs to another seat, or when the owning schema declares no
 * reveal kind (nothing a reveal dialog could present).
 */
export function derivePendingRevealAck(
  state: GameState,
  actorSeat: number | null,
): PendingRevealAck | null {
  if (actorSeat === null || state.pendingRevealAcks.length === 0) return null;

  const action = [...state.actions]
    .reverse()
    .find((candidate) => state.pendingRevealAcks.includes(candidate.schemaId));
  if (action === undefined || action.actorSeat !== actorSeat) return null;

  const schema = getSchema(action.schemaId);
  const revealKind = schema.kind !== 'compound' ? schema.ui?.revealKind : undefined;
  if (revealKind === undefined) return null;

  return { schemaId: action.schemaId, revealKind, actorSeat: action.actorSeat };
}

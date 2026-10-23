/**
 * pendingRevealAck — derivation tests.
 *
 * The derivation mirrors the engine's ack-owner lookup
 * (validateRevealAckActor): a pending reveal ack belongs to the latest
 * recorded action whose schemaId is listed in `pendingRevealAcks`, and only
 * that action's actor may ack. These tests pin that mirror, including the
 * compound case: the engine never registers a reveal ack for a compound
 * schema (the only compound role, the witch, declares no revealKind and its
 * resolver produces no reveal — buildRevealPayload fails fast otherwise),
 * so a compound schemaId in the pending list derives nothing.
 */
import type { ProtocolAction } from '@game-judge/game-engine/games/werewolf/public';

import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { derivePendingRevealAck } from '../pendingRevealAck';

function action(schemaId: ProtocolAction['schemaId'], actorSeat: number): ProtocolAction {
  return { schemaId, actorSeat, targetSeat: 3, timestamp: 1_700_000_000_000 };
}

describe('derivePendingRevealAck', () => {
  it('returns null when no reveal ack is pending', () => {
    const state = buildWerewolfTestState({ actions: [action('seerCheck', 0)] });

    expect(derivePendingRevealAck(state, 0)).toBeNull();
  });

  it('returns null when the actor seat is unknown', () => {
    const state = buildWerewolfTestState({
      actions: [action('seerCheck', 0)],
      pendingRevealAcks: ['seerCheck'],
    });

    expect(derivePendingRevealAck(state, null)).toBeNull();
  });

  it('derives the pending ack owned by the effective actor', () => {
    const state = buildWerewolfTestState({
      actions: [action('seerCheck', 0)],
      pendingRevealAcks: ['seerCheck'],
    });

    expect(derivePendingRevealAck(state, 0)).toEqual({
      schemaId: 'seerCheck',
      revealKind: 'seer',
      actorSeat: 0,
    });
  });

  it('returns null when the pending ack belongs to another seat', () => {
    const state = buildWerewolfTestState({
      actions: [action('seerCheck', 2)],
      pendingRevealAcks: ['seerCheck'],
    });

    expect(derivePendingRevealAck(state, 0)).toBeNull();
  });

  it('binds to the latest recorded action listed in pendingRevealAcks', () => {
    const state = buildWerewolfTestState({
      actions: [action('seerCheck', 0), action('psychicCheck', 0)],
      pendingRevealAcks: ['seerCheck', 'psychicCheck'],
    });

    expect(derivePendingRevealAck(state, 0)).toEqual({
      schemaId: 'psychicCheck',
      revealKind: 'psychic',
      actorSeat: 0,
    });
  });

  it('returns null when the latest matching action belongs to another seat', () => {
    const state = buildWerewolfTestState({
      actions: [action('seerCheck', 0), action('psychicCheck', 2)],
      pendingRevealAcks: ['seerCheck', 'psychicCheck'],
    });

    expect(derivePendingRevealAck(state, 0)).toBeNull();
  });

  it('returns null for a pending compound schema (engine never registers one)', () => {
    const state = buildWerewolfTestState({
      actions: [action('witchAction', 0)],
      pendingRevealAcks: ['witchAction'],
    });

    expect(derivePendingRevealAck(state, 0)).toBeNull();
  });

  it('returns null when the owning schema declares no reveal kind', () => {
    const state = buildWerewolfTestState({
      actions: [action('wolfKill', 0)],
      pendingRevealAcks: ['wolfKill'],
    });

    expect(derivePendingRevealAck(state, 0)).toBeNull();
  });
});

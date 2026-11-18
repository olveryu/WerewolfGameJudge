/**
 * Identity Viewing Protocol — secrethitler scenario.
 *
 * Secrethitler follows the protocol: dealing (secrethitler.roles.assign)
 * lands in the viewing stage with an empty record
 * (secrethitler.role.viewed, idempotent), and play is gated at the
 * host's begin command (secrethitler.game.begin) — play opens only once
 * every seated player has viewed their identity. The host can take over
 * bot seats individually or use the host's bulk-mark action.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { describeIdentityViewingProtocol } from '../../../platform/room/__tests__/identityViewingScenarios';
import { isBotSeat } from '../../../platform/room/seating';
import type { SecrethitlerCommand } from '../commands/types';
import { secrethitlerEngine } from '../engine';
import { parseSecrethitlerState } from '../state/parseState';
import { DEFAULT_SECRETHITLER_CONFIG, getSecrethitlerViewingParticipants } from '../state/types';

function game(humanCount: number) {
  const session = createEngineSession(secrethitlerEngine, {
    config: { ...DEFAULT_SECRETHITLER_CONFIG, numberOfPlayers: 5 },
    parse: parseSecrethitlerState,
  });
  const send = (
    command: SecrethitlerCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => session.send(command, userId, controlledSeat);
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < humanCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (humanCount < 5) send({ type: 'room.seat.fillBots' });
  send({ type: 'secrethitler.roles.assign' });
  return { session, send, seatUser };
}

describeIdentityViewingProtocol({
  game: 'secrethitler',
  makeSession: () => {
    const { session, send, seatUser } = game(3);
    return {
      viewedSeats: () => session.state.roleViewedSeats,
      participants: () => getSecrethitlerViewingParticipants(session.state),
      view: (seat) => {
        // Bot seats have no user to view with; the host takes over the seat.
        if (isBotSeat(session.state.roster, seat)) {
          send({ type: 'secrethitler.role.viewed' }, 'host', seat);
        } else {
          send({ type: 'secrethitler.role.viewed' }, seatUser(seat));
        }
      },
      markAllBotsViewed: () => {
        send({ type: 'secrethitler.bots.markAllBotsViewed' });
      },
      isCheckpointOpen: () => {
        // The checkpoint is the host's begin gate: probe it with a
        // non-mutating decide so the shared scenarios can ask at any
        // point without starting the game.
        const decision = session.decide({ type: 'secrethitler.game.begin' }, 'host');
        return decision.kind === 'commit';
      },
    };
  },
});

describe('Identity Viewing Protocol — secrethitler confirm through the shared skeleton (D-2)', () => {
  it('still confirms an already-viewed seat after play began', () => {
    const { session, send, seatUser } = game(3);
    send({ type: 'secrethitler.role.viewed' }, seatUser(1));
    send({ type: 'secrethitler.role.viewed' }, seatUser(2));
    for (const participant of getSecrethitlerViewingParticipants(session.state)) {
      if (isBotSeat(session.state.roster, participant.seat)) {
        send({ type: 'secrethitler.role.viewed' }, 'host', participant.seat);
      }
    }
    send({ type: 'secrethitler.role.viewed' }, 'host');
    send({ type: 'secrethitler.game.begin' });
    const decision = session.decide({ type: 'secrethitler.role.viewed' }, seatUser(1));
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') expect(decision.events).toEqual([]);
  });
});

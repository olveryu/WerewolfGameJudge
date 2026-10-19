/**
 * Identity Viewing Protocol — demo scenario.
 *
 * Demo follows the protocol: dealing (demo.game.start)
 * lands in the viewing stage with an empty record
 * (demo.role.viewed, idempotent), and play is gated at the
 * host's begin command (demo.game.begin) — play opens only once
 * every seated player has viewed their identity. Bot seats count like
 * everyone else; the host fills their records with the scaffold action
 * (demo.bots.markAllBotsViewed).
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { describeIdentityViewingProtocol } from '../../../platform/room/__tests__/identityViewingScenarios';
import { isBotSeat } from '../../../platform/room/seating';
import type { DemoCommand } from '../commands/types';
import { demoEngine } from '../engine';
import { parseDemoState } from '../state/parseState';
import { DEFAULT_DEMO_CONFIG, getDemoViewingParticipants } from '../state/types';

function game(humanCount: number) {
  const session = createEngineSession(demoEngine, {
    config: { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    parse: parseDemoState,
  });
  const send = (command: DemoCommand, userId = 'host', controlledSeat: number | null = null) =>
    session.send(command, userId, controlledSeat);
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < humanCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (humanCount < 4) send({ type: 'room.seat.fillBots' });
  send({ type: 'demo.game.start' });
  return { session, send, seatUser };
}

describeIdentityViewingProtocol({
  game: 'demo',
  makeSession: () => {
    const { session, send, seatUser } = game(3);
    return {
      viewedSeats: () => session.state.roleViewedSeats,
      participants: () => getDemoViewingParticipants(session.state),
      view: (seat) => {
        // Bot seats have no user to view with; the driver marks them
        // through the host scaffold action (all bots at once).
        if (isBotSeat(session.state.roster, seat)) {
          send({ type: 'demo.bots.markAllBotsViewed' });
        } else {
          send({ type: 'demo.role.viewed' }, seatUser(seat));
        }
      },
      markAllBotsViewed: () => send({ type: 'demo.bots.markAllBotsViewed' }),
      isCheckpointOpen: () => {
        // The checkpoint is the host's begin gate: probe it with a
        // non-mutating decide so the shared scenarios can ask at any
        // point without starting the game.
        const decision = session.decide({ type: 'demo.game.begin' }, 'host');
        return decision.kind === 'commit';
      },
    };
  },
});

describe('Identity Viewing Protocol — demo confirm through the shared skeleton (D-2)', () => {
  it('still confirms an already-viewed seat after play began', () => {
    const { session, send, seatUser } = game(3);
    send({ type: 'demo.role.viewed' }, seatUser(1));
    send({ type: 'demo.role.viewed' }, seatUser(2));
    send({ type: 'demo.bots.markAllBotsViewed' });
    send({ type: 'demo.role.viewed' }, 'host');
    send({ type: 'demo.game.begin' });
    const decision = session.decide({ type: 'demo.role.viewed' }, seatUser(1));
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') expect(decision.events).toEqual([]);
  });
});

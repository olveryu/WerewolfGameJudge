/**
 * Demo full chain (Wave 9 PR-4 acceptance, plan §10.3): one game idles
 * through create → seat → deal → view → deadline → settle using only
 * authoritative commands. The reference game exists so CI proves the
 * generated skeleton — seating, the identity-viewing checkpoint and
 * the armed stage deadline in the #162 scheduled-effect form — still
 * lines up with the chassis end to end.
 */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { getBotSeats, isBotSeat } from '../../../platform/room/seating';
import type { DemoCommand } from '../commands/types';
import { DEMO_REASONS } from '../domain/decision';
import { DEMO_STAGE_DURATION_MS } from '../domain/rules';
import { getDemoViewModel } from '../domain/visibility';
import { demoEngine } from '../engine';
import { parseDemoState } from '../state/parseState';
import { type DemoState } from '../state/types';

function game(humanCount: number) {
  const session = createEngineSession(demoEngine, {
    config: { numberOfPlayers: 4 },
    parse: parseDemoState,
  });
  const send = (command: DemoCommand, userId = 'host', controlledSeat: number | null = null) =>
    session.send(command, userId, controlledSeat);
  const decideAs = (command: DemoCommand, userId = 'host', controlledSeat: number | null = null) =>
    session.decide(command, userId, controlledSeat);
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < humanCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (humanCount < 4) send({ type: 'room.seat.fillBots' });
  return {
    get state(): DemoState {
      return session.state;
    },
    effects: session.effects,
    session,
    send,
    decideAs,
    seatUser,
  };
}

function dealViewAndBegin(session: ReturnType<typeof game>): void {
  session.send({ type: 'demo.roles.assign' });
  for (let seat = 0; seat < session.state.config.numberOfPlayers; seat += 1) {
    if (isBotSeat(session.state.roster, seat)) continue;
    session.send({ type: 'demo.role.viewed' }, session.seatUser(seat));
  }
  if (getBotSeats(session.state.roster).length > 0) {
    session.send({ type: 'demo.bots.markAllBotsViewed' });
  }
  session.send({ type: 'demo.game.begin' });
}

describe('Demo full chain', () => {
  it('create → seat → deal → view → deadline → settle, exactly one completion', () => {
    const session = game(2);

    // create: an empty lobby.
    expect(session.state.phase).toEqual({ kind: 'lobby' });
    // seat: two humans took seats, the roster fill seated bots.
    expect(Object.keys(session.state.roster)).toHaveLength(4);

    // deal: identities are dealt into the viewing stage, nobody has
    // viewed yet (the engine never auto-marks, bots included).
    session.send({ type: 'demo.roles.assign' });
    expect(session.state.phase.kind).toBe('viewing');
    expect(Object.keys(session.state.identities)).toHaveLength(4);
    expect(session.state.roleViewedSeats).toEqual([]);

    // view: humans mark themselves; the host marks the bot seats
    // through the test scaffold.
    session.send({ type: 'demo.role.viewed' }, session.seatUser(0));
    session.send({ type: 'demo.role.viewed' }, session.seatUser(1));
    session.send({ type: 'demo.bots.markAllBotsViewed' });

    // begin: the playing stage opens with its deadline armed and the
    // scheduled settle effect emitted exactly once.
    const begunAt = session.session.now();
    session.send({ type: 'demo.game.begin' });
    const deadlineAt = begunAt + DEMO_STAGE_DURATION_MS;
    expect(session.state.phase).toEqual({ kind: 'playing', deadlineAt });
    expect(session.effects).toEqual([
      { type: 'demo.settle.due', payload: { gameSequence: 1, deadlineAt } },
    ]);

    // deadline gate: a settle delivery before the deadline rejects.
    const early = session.session.decideAs(
      { type: 'demo.phase.settleExpired' },
      session.session.systemContext('settle-effect'),
    );
    expect(early.kind).toBe('reject');
    if (early.kind === 'reject') expect(early.reason).toBe(DEMO_REASONS.deadline);

    // deadline reached: the system channel settles the game.
    session.session.advance(DEMO_STAGE_DURATION_MS);
    const settled = session.session.sendAs(
      { type: 'demo.phase.settleExpired' },
      session.session.systemContext('settle-effect'),
    );
    expect(settled.phase.kind).toBe('ended');
    expect(settled.xpSettled).toBe(true);

    // settle: exactly one completion effect naming the human
    // participants, and identities are public in the terminal view.
    const completions = session.effects.filter((effect) => effect.type === 'demo.game.completed');
    expect(completions).toHaveLength(1);
    expect(completions[0]?.payload.participantUserIds).toEqual(['host', 'u1']);
    const view = getDemoViewModel(session.state, 0);
    expect(view.seats.every((seat) => seat.identity !== null)).toBe(true);

    // A replayed settle delivery rejects instead of settling twice.
    const replay = session.session.decideAs(
      { type: 'demo.phase.settleExpired' },
      session.session.systemContext('settle-effect'),
    );
    expect(replay.kind).toBe('reject');
    if (replay.kind === 'reject') expect(replay.reason).toBe(DEMO_REASONS.phase);
  });

  it('rejects the internal settle channel for a regular user actor', () => {
    const session = game(4);
    dealViewAndBegin(session);
    session.session.advance(DEMO_STAGE_DURATION_MS);
    const decision = session.decideAs({ type: 'demo.phase.settleExpired' }, session.seatUser(1));
    expect(decision.kind).toBe('reject');
    expect(session.state.phase.kind).toBe('playing');
  });
});

/** Exercises Demo through authoritative commands, never injecting progressed state. */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { getBotSeats, isBotSeat } from '../../../platform/room/seating';
import type { DemoCommand } from '../commands/types';
import { DEMO_REASONS } from '../domain/decision';
import { DEMO_STAGE_DURATION_MS } from '../domain/rules';
import { getDemoViewModel } from '../domain/visibility';
import { demoEngine, endDemoGame } from '../engine';
import { parseDemoState } from '../state/parseState';
import { DEFAULT_DEMO_CONFIG, type DemoConfig, type DemoState } from '../state/types';

function game(
  configOverrides: Partial<DemoConfig> = {},
  humanCount?: number,
  fillRemainingWithBots = true,
) {
  const numberOfPlayers = configOverrides.numberOfPlayers ?? DEFAULT_DEMO_CONFIG.numberOfPlayers;
  const session = createEngineSession(demoEngine, {
    config: { ...DEFAULT_DEMO_CONFIG, ...configOverrides },
    parse: parseDemoState,
  });
  const send = (command: DemoCommand, userId = 'host', controlledSeat: number | null = null) =>
    session.send(command, userId, controlledSeat);
  const decideAs = (command: DemoCommand, userId = 'host', controlledSeat: number | null = null) =>
    session.decide(command, userId, controlledSeat);
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const seatCount = humanCount ?? numberOfPlayers;
  for (let seat = 0; seat < seatCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (humanCount !== undefined && humanCount < numberOfPlayers && fillRemainingWithBots) {
    send({ type: 'room.seat.fillBots' });
  }
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

function viewAllAndBegin(session: ReturnType<typeof game>): void {
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

describe('Demo lobby and seating', () => {
  it('creates an empty lobby and rejects an invalid config', () => {
    const session = game({ numberOfPlayers: 4 });
    expect(session.state.phase).toEqual({ kind: 'lobby' });
    expect(() =>
      demoEngine.createInitialState(
        { numberOfPlayers: 3 },
        { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
      ),
    ).toThrow(DEMO_REASONS.config);
  });

  it('rejects starting before every seat is filled', () => {
    const session = game({ numberOfPlayers: 4 }, 2, false);
    const decision = session.decideAs({ type: 'demo.roles.assign' });
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') expect(decision.reason).toBe(DEMO_REASONS.full);
  });

  it('rejects config updates that strand occupied seats', () => {
    const session = game({ numberOfPlayers: 6 }, 5);
    const decision = session.decideAs({
      type: 'demo.config.update',
      config: { numberOfPlayers: 4 },
    });
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') expect(decision.reason).toBe(DEMO_REASONS.occupied);
  });
});

describe('Demo identity viewing checkpoint', () => {
  it('deals identities into the viewing stage with an empty view record', () => {
    const session = game({ numberOfPlayers: 4 }, 2);
    session.send({ type: 'demo.roles.assign' });
    expect(session.state.phase.kind).toBe('viewing');
    expect(Object.keys(session.state.identities)).toHaveLength(4);
    expect(session.state.roleViewedSeats).toEqual([]);
  });

  it('rejects role.viewed in the lobby', () => {
    const session = game({ numberOfPlayers: 4 });
    const decision = session.decideAs({ type: 'demo.role.viewed' }, session.seatUser(1));
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') expect(decision.reason).toBe(DEMO_REASONS.phase);
  });

  it('holds begin until every seat — bots included — has viewed', () => {
    const session = game({ numberOfPlayers: 4 }, 2);
    session.send({ type: 'demo.roles.assign' });
    session.send({ type: 'demo.role.viewed' }, session.seatUser(0));
    session.send({ type: 'demo.role.viewed' }, session.seatUser(1));
    const blocked = session.decideAs({ type: 'demo.game.begin' });
    expect(blocked.kind).toBe('reject');
    if (blocked.kind === 'reject') expect(blocked.reason).toBe(DEMO_REASONS.notAllViewed);
    session.send({ type: 'demo.bots.markAllBotsViewed' });
    session.send({ type: 'demo.game.begin' });
    expect(session.state.phase.kind).toBe('playing');
  });

  it('projects identities per viewer: self visible, others hidden until the end', () => {
    const session = game({ numberOfPlayers: 4 }, 4);
    session.send({ type: 'demo.roles.assign' });
    const view = getDemoViewModel(session.state, 1);
    expect(view.myIdentity).not.toBeNull();
    expect(view.seats.every((seat) => seat.identity === null)).toBe(true);
    expect(view.unviewedRoleSeats).toEqual([0, 1, 2, 3]);
  });
});

describe('Demo stage deadline settlement', () => {
  it('opens the playing stage with an armed deadline and a settle.due effect', () => {
    const session = game({ numberOfPlayers: 4 }, 4);
    const startedAt = session.session.now();
    viewAllAndBegin(session);
    expect(session.state.phase).toEqual({
      kind: 'playing',
      deadlineAt: startedAt + DEMO_STAGE_DURATION_MS,
    });
    expect(session.effects).toEqual([
      {
        type: 'demo.settle.due',
        payload: { gameSequence: 1, deadlineAt: startedAt + DEMO_STAGE_DURATION_MS },
      },
    ]);
    expect(getDemoViewModel(session.state, 0).stageDeadlineAt).toBe(
      startedAt + DEMO_STAGE_DURATION_MS,
    );
  });

  it('rejects settle before the deadline, then settles exactly once at the deadline', () => {
    const session = game({ numberOfPlayers: 4 }, 3);
    viewAllAndBegin(session);
    const early = demoEngine.decide(
      session.state,
      { type: 'demo.phase.settleExpired' },
      session.session.systemContext('settle-effect'),
    );
    expect(early.kind).toBe('reject');
    if (early.kind === 'reject') expect(early.reason).toBe(DEMO_REASONS.deadline);
    session.session.advance(DEMO_STAGE_DURATION_MS);
    const state = session.session.sendAs(
      { type: 'demo.phase.settleExpired' },
      session.session.systemContext('settle-effect'),
    );
    expect(state.phase.kind).toBe('ended');
    expect(state.xpSettled).toBe(true);
    const completions = session.effects.filter((effect) => effect.type === 'demo.game.completed');
    expect(completions).toHaveLength(1);
    expect(completions[0]?.payload.participantUserIds).toEqual(['host', 'u1', 'u2']);
  });

  it('rejects the internal settle channel for a user actor', () => {
    const session = game({ numberOfPlayers: 4 }, 4);
    viewAllAndBegin(session);
    session.session.advance(DEMO_STAGE_DURATION_MS);
    const internalAsUser = session.decideAs({ type: 'demo.phase.settleExpired' }, 'u1');
    expect(internalAsUser.kind).toBe('reject');
  });
});

describe('Demo gameplay seam', () => {
  it('rejects the example gameplay command as not implemented (no fake green)', () => {
    const session = game({ numberOfPlayers: 4 }, 4);
    viewAllAndBegin(session);
    const decision = session.decideAs({ type: 'demo.gameplay.example' });
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') expect(decision.reason).toBe(DEMO_REASONS.notImplemented);
  });

  it('ends through the terminal seam with exactly one completion effect', () => {
    const session = game({ numberOfPlayers: 4 }, 3);
    viewAllAndBegin(session);
    const decision = endDemoGame(session.state, session.session.context('host'));
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.effects).toHaveLength(1);
    const completion = decision.effects[0];
    expect(completion?.type).toBe('demo.game.completed');
    if (completion?.type === 'demo.game.completed') {
      expect(completion.payload.participantUserIds).toEqual(['host', 'u1', 'u2']);
    }
    const ended = decision.events.reduce(demoEngine.evolve, session.state);
    expect(ended.phase.kind).toBe('ended');
    expect(ended.xpSettled).toBe(true);
    const view = getDemoViewModel(ended, 0);
    expect(view.seats.every((seat) => seat.identity !== null)).toBe(true);
  });
});

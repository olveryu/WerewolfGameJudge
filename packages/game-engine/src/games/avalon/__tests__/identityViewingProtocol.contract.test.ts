/**
 * Identity Viewing Protocol — avalon scenario (P-1 batch C).
 *
 * Avalon gains the protocol in this batch: the engine records
 * roleViewedSeats (avalon.role.viewed, idempotent), and the first
 * quest is gated — when the night steps finish, the night only
 * completes once every human has viewed their role; the last missing
 * view releases the checkpoint. Bot seats never block. Same-named
 * scenario files live in each compliant game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { haveAllHumansViewed, listUnviewedSeats } from '../../../platform/room/identityViewing';
import type { AvalonCommand } from '../commands/types';
import { AVALON_REASONS, type AvalonEffect } from '../domain/decision';
import { getAvalonNightParticipants } from '../domain/rules';
import { getAvalonViewModel } from '../domain/visibility';
import { avalonEngine } from '../engine';
import { migratePersistedAvalonState, parseAvalonState } from '../state/codec';
import {
  AVALON_NIGHT_STEPS,
  type AvalonConfig,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonViewingParticipants,
} from '../state/types';

function game(configOverrides: Partial<AvalonConfig> = {}, humanCount?: number) {
  const nowMs = 1000;
  let commandNumber = 0;
  const numberOfPlayers = configOverrides.numberOfPlayers ?? DEFAULT_AVALON_CONFIG.numberOfPlayers;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, ...configOverrides },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const effects: AvalonEffect[] = [];
  const context = (userId: string, controlledSeat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: `seed:${commandNumber}`,
  });
  const apply = (command: AvalonCommand, ctx: CommandContext) => {
    const decision = avalonEngine.decide(state, command, ctx);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseAvalonState(
      JSON.parse(
        JSON.stringify(avalonEngine.normalize(decision.events.reduce(avalonEngine.evolve, state))),
      ),
    );
    effects.push(...decision.effects);
    return state;
  };
  const send = (command: AvalonCommand, userId = 'host', controlledSeat: number | null = null) =>
    apply(command, context(userId, controlledSeat));
  const decideAs = (
    command: AvalonCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => avalonEngine.decide(state, command, context(userId, controlledSeat));
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const seatCount = humanCount ?? numberOfPlayers;
  for (let seat = 0; seat < seatCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (humanCount !== undefined && humanCount < numberOfPlayers) {
    send({ type: 'room.seat.fillBots' });
  }

  const api = {
    get state() {
      return state;
    },
    effects,
    send,
    decideAs,
    seatUser,
    startGame() {
      send({ type: 'avalon.game.start' });
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    },
    view(seat: number) {
      send({ type: 'avalon.role.viewed' }, seatUser(seat));
    },
    viewAllHumans() {
      for (let seat = 0; seat < numberOfPlayers; seat += 1) {
        if (state.realSeats[seat] !== undefined) api.view(seat);
      }
    },
    /** Confirms every night step's participants, in order. */
    walkNight() {
      for (const step of AVALON_NIGHT_STEPS) {
        if (state.phase.kind !== 'night') break;
        if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
        const participants = getAvalonNightParticipants(state.roles, step);
        for (const seat of participants) {
          if (state.realSeats[seat] === undefined) {
            send({ type: 'avalon.night.confirm' }, 'host', seat);
          } else {
            send({ type: 'avalon.night.confirm' }, seatUser(seat));
          }
        }
      }
      if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
    },
    seatOfRole(role: string): number {
      const seat = Object.keys(state.roles).find((key) => state.roles[Number(key)] === role);
      if (seat === undefined) throw new Error(`role ${role} not dealt`);
      return Number(seat);
    },
  };
  return api;
}

describe('Identity Viewing Protocol — avalon record and pre-quest checkpoint', () => {
  it('rejects role.viewed in the lobby', () => {
    const session = game({ numberOfPlayers: 5 });
    const decision = session.decideAs({ type: 'avalon.role.viewed' }, session.seatUser(1));
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') expect(decision.reason).toBe(AVALON_REASONS.phase);
  });

  it('records views idempotently and projects them per viewer', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    expect(session.state.roleViewedSeats).toEqual([]);

    session.view(2);
    expect(session.state.roleViewedSeats).toEqual([2]);
    session.view(2);
    expect(session.state.roleViewedSeats).toEqual([2]);
    session.view(0);
    expect(session.state.roleViewedSeats).toEqual([0, 2]);

    expect(getAvalonViewModel(session.state, 2).hasViewedRole).toBe(true);
    expect(getAvalonViewModel(session.state, 1).hasViewedRole).toBe(false);
    expect(getAvalonViewModel(session.state, 1).unviewedRoleSeats).toEqual([1, 3, 4]);
    expect(
      listUnviewedSeats(
        getAvalonViewingParticipants(session.state),
        session.state.roleViewedSeats,
      ).map((participant) => participant.seat),
    ).toEqual([1, 3, 4]);
  });

  it('holds the night open until the last human views, then releases the checkpoint', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    // A loyal servant has no night step; leave exactly that seat unviewed.
    const servant = session.seatOfRole('loyalServant');
    for (let seat = 0; seat < 5; seat += 1) {
      if (seat !== servant) session.view(seat);
    }
    expect(
      haveAllHumansViewed(
        getAvalonViewingParticipants(session.state),
        session.state.roleViewedSeats,
      ),
    ).toBe(false);

    session.walkNight();
    // Night steps are done, but the checkpoint holds: still night.
    expect(session.state.phase.kind).toBe('night');

    session.view(servant);
    expect(session.state.phase.kind).toBe('nominate');
    expect(session.state.pendingAudioEffects.map((effect) => effect.audioKey)).toContain(
      'night_end',
    );
    expect(
      haveAllHumansViewed(
        getAvalonViewingParticipants(session.state),
        session.state.roleViewedSeats,
      ),
    ).toBe(true);
  });

  it('never blocks on bot seats: one human viewing is enough with bots filling the room', () => {
    const session = game({ numberOfPlayers: 5 }, 1);
    session.startGame();
    session.viewAllHumans();
    // The unviewed list is about checkpoint blockers: bots never appear.
    expect(getAvalonViewModel(session.state, 0).unviewedRoleSeats).toEqual([]);
    session.walkNight();
    expect(session.state.phase.kind).toBe('nominate');
  });

  it('loads a persisted v1 state (no roleViewedSeats) through the migration', () => {
    const session = game({ numberOfPlayers: 5 });
    session.startGame();
    const persisted = JSON.parse(JSON.stringify(session.state)) as Record<string, unknown>;
    delete persisted.roleViewedSeats;
    persisted.stateVersion = 1;
    const migrated = migratePersistedAvalonState(persisted);
    expect(migrated.stateVersion).toBe(2);
    expect(migrated.roleViewedSeats).toEqual([]);
    // The strict current-version parser still rejects the legacy shape.
    expect(() => parseAvalonState(persisted)).toThrow();
  });
});

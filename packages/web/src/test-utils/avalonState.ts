/** Canonical Avalon states for client tests (AU-46): minimal, and played through the real engine. */

import {
  type AvalonCommand,
  avalonEngine,
  type AvalonNightStep,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isAvalonEvilRole,
} from '@game-judge/game-engine/games/avalon/public';

import type { ReviewTestRounds } from './reviewTestRounds';

const ROOM_CODE = 'ABCD';
const HOST_USER_ID = 'host-1';
const PLAYER_COUNT = 5;

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

/** The engine's initial lobby state for room ABCD, with field overrides. */
export function buildAvalonTestState(overrides: Partial<AvalonState> = {}): AvalonState {
  return {
    ...avalonEngine.createInitialState(DEFAULT_AVALON_CONFIG, {
      roomCode: ROOM_CODE,
      hostUserId: HOST_USER_ID,
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}

/** The user at each seat of `playAvalonTestGame`: the host at seat 0, `u<seat>` elsewhere. */
export function avalonTestSeatUser(seat: number): string {
  return seat === 0 ? HOST_USER_ID : `u${seat}`;
}

/**
 * Plays a five-seat game through the real engine: five humans sit (P0…P4),
 * the host deals, everyone views, the night is confirmed, then
 * `failedQuests` quests are played — each approved by everyone, with the
 * first evil seat on the team playing fail. Three failures end the game
 * (坏人获胜, 三个任务失败); fewer leave it at the next nomination. Every
 * reveal countdown settles at its deadline through the system channel.
 */
export function playAvalonTestGame(failedQuests: 0 | 1 | 2 | 3): AvalonState {
  let nowMs = 0;
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: PLAYER_COUNT },
    { roomCode: ROOM_CODE, hostUserId: HOST_USER_ID, nowMs, commandId: 'create' },
  );
  const read = (): AvalonState => state;
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  const apply = (command: AvalonCommand, context: CommandContext) => {
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
    }
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  const asSeat = (command: AvalonPublicCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: avalonTestSeatUser(seat) },
      controlledSeat: null,
      ...execution(),
    });
  const settle = () => {
    const { phase } = read();
    if ((phase.kind !== 'vote' && phase.kind !== 'quest') || phase.deadlineAt === null) {
      throw new Error(`[FAIL-FAST] Cannot settle Avalon ${phase.kind}`);
    }
    nowMs = phase.deadlineAt;
    apply(
      { type: 'avalon.phase.settleExpired' },
      { actor: { kind: 'system', effectId: 'effect:test' }, controlledSeat: null, ...execution() },
    );
  };
  const ackAudio = () => {
    const { isAudioPlaying, audioBatchId } = read();
    if (isAudioPlaying) asSeat({ type: 'avalon.audio.ack', audioBatchId }, 0);
  };
  const nightStep = (): AvalonNightStep | null => {
    const { phase } = read();
    return phase.kind === 'night' ? phase.step : null;
  };
  const seats = Array.from({ length: PLAYER_COUNT }, (_, seat) => seat);

  for (const seat of seats) {
    asSeat({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seat);
  }
  asSeat({ type: 'avalon.roles.assign' }, 0);
  for (const seat of seats) asSeat({ type: 'avalon.role.viewed' }, seat);
  asSeat({ type: 'avalon.game.begin' }, 0);
  ackAudio();
  for (let step = nightStep(); step !== null; step = nightStep()) {
    for (const seat of getAvalonNightParticipants(read().roles, step)) {
      asSeat({ type: 'avalon.night.confirm' }, seat);
    }
    ackAudio();
  }
  const evilSeat = seats.find((seat) => {
    const role = read().roles[seat];
    return role !== undefined && isAvalonEvilRole(role);
  });
  if (evilSeat === undefined) throw new Error('[FAIL-FAST] Avalon deal has no evil seat');
  for (let quest = 0; quest < failedQuests; quest += 1) {
    const { phase, leaderSeat } = read();
    if (phase.kind !== 'nominate') {
      throw new Error(`[FAIL-FAST] Avalon quest ${quest + 1} found ${phase.kind}`);
    }
    const team = [evilSeat, ...seats.filter((seat) => seat !== evilSeat)].slice(
      0,
      phase.requiredSize,
    );
    asSeat({ type: 'avalon.team.preselect', seats: team }, leaderSeat);
    asSeat({ type: 'avalon.team.propose', seats: team }, leaderSeat);
    for (const seat of seats) asSeat({ type: 'avalon.team.vote', vote: 'approve' }, seat);
    settle();
    for (const seat of team) {
      asSeat({ type: 'avalon.quest.play', play: seat === evilSeat ? 'fail' : 'success' }, seat);
    }
    settle();
  }
  return read();
}

export const AVALON_REVIEW_ROUNDS: ReviewTestRounds<AvalonState> = {
  lobby: () => buildAvalonTestState(),
  ended: () => playAvalonTestGame(3),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};

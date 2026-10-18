/**
 * Avalon guidance matrix: every (phase × viewer) cell declared in
 * avalonGuidanceMatrix.ts is held true against the real shell model,
 * with states produced by the real engine (never hand-assembled).
 * Cell semantics: the phase's entry state, before the viewer acts.
 */
import {
  AVALON_PHASES,
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { AVALON_GUIDANCE_MATRIX } from '../avalonGuidanceMatrix';
import { type AvalonRoomShellModelInput, createAvalonRoomShellModel } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/** Reads the phase kind through a call so TS narrowing never goes stale across sends. */
const phaseKind = (s: Session): AvalonState['phase']['kind'] => s.state.phase.kind;

interface Session {
  readonly state: AvalonState;
  send(command: AvalonPublicCommand, userId?: string): void;
  trySend(command: AvalonPublicCommand, userId?: string): boolean;
}

function session(playerCount: 5 | 9): Session {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: playerCount },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const apply = (command: AvalonPublicCommand, userId: string): boolean => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') return false;
    state = decision.events.reduce(avalonEngine.evolve, state);
    return true;
  };
  for (let seat = 0; seat < playerCount; seat += 1) {
    const ok = apply(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seatUser(seat),
    );
    if (!ok) throw new Error(`seat ${seat} take rejected`);
  }
  return {
    get state() {
      return state;
    },
    send(command, userId = 'host') {
      if (!apply(command, userId)) throw new Error(`rejected: ${command.type}`);
    },
    trySend(command, userId = 'host') {
      return apply(command, userId);
    },
  };
}

function startViewing(s: Session) {
  s.send({ type: 'avalon.game.start' });
  if (s.state.phase.kind !== 'viewing') throw new Error('expected viewing');
}

function beginNight(s: Session) {
  startViewing(s);
  const count = s.state.config.numberOfPlayers;
  for (let seat = 0; seat < count; seat += 1) {
    s.send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  s.send({ type: 'avalon.game.begin' });
  if (s.state.isAudioPlaying) s.send({ type: 'avalon.audio.ack' }, 'host');
  if (s.state.phase.kind !== 'night') throw new Error('expected night');
}

function completeNight(s: Session) {
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (s.state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(s.state.roles, step)) {
      s.send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (s.state.isAudioPlaying) s.send({ type: 'avalon.audio.ack' }, 'host');
  }
  if (s.state.phase.kind !== 'nominate') throw new Error('expected nominate');
}

function proposeTeam(s: Session, team: readonly number[]) {
  if (s.state.phase.kind !== 'nominate') throw new Error('expected nominate');
  const leader = s.state.leaderSeat;
  s.send({ type: 'avalon.team.updateDraft', seats: [...team] }, seatUser(leader));
  s.send({ type: 'avalon.team.propose' }, seatUser(leader));
  if (phaseKind(s) !== 'vote') throw new Error('expected vote');
}

function approveTeam(s: Session) {
  const count = s.state.config.numberOfPlayers;
  for (let seat = 0; seat < count; seat += 1) {
    s.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
  }
  s.send({ type: 'avalon.vote.finish' });
  if (s.state.phase.kind !== 'quest') throw new Error('expected quest');
}

function finishQuest(s: Session, team: readonly number[]) {
  for (const seat of team) {
    s.send({ type: 'avalon.quest.play', play: 'success' }, seatUser(seat));
  }
  s.send({ type: 'avalon.quest.finish' });
}

/** Plays one full quest round with an all-success team; returns the team used. */
function playQuestRound(s: Session): readonly number[] {
  if (s.state.phase.kind !== 'nominate') throw new Error('expected nominate');
  const required = s.state.phase.requiredSize;
  const team: number[] = [s.state.leaderSeat];
  for (let seat = 0; team.length < required; seat += 1) {
    if (!team.includes(seat)) team.push(seat);
  }
  proposeTeam(s, team);
  approveTeam(s);
  finishQuest(s, team);
  return team;
}

function capabilities(): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      isSetup: true,
      isHost: true,
      mySeat: 0,
      supportsBots: true,
      hasOccupiedSeats: true,
      isRoomFull: true,
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      shareRoom: jest.fn(),
    }),
    canViewProfiles: { isAllowed: true, execute: jest.fn() },
    canTakeOverBots: createBotTakeoverCapability(true, jest.fn()),
  };
}

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: jest.fn(),
  requestMoveSeat: jest.fn(),
  confirm: jest.fn(async () => undefined),
  cancel: jest.fn(),
};

type Viewer = 'host' | 'seated' | 'spectator';

function bottomMessage(state: AvalonState, viewer: Viewer, seatedSeat = 2): string | null {
  const isLobby = state.phase.kind === 'lobby';
  const base: AvalonRoomShellModelInput = {
    roomCode: '1234',
    capabilities: capabilities(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: 'host', avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    state,
    revision: 7,
    userId: 'host',
    controlledSeat: null,
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: jest.fn(),
    seatController,
    profileSelection: null,
    onProfileClose: jest.fn(),
    onProfileLeaveSeat: jest.fn(),
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    isLobby,
    isHost: true,
    mySeat: 0,
    effectiveSeat: 0,
    onViewRolePress: jest.fn(),
    onNightInfoPress: jest.fn(),
    isSubmitting: false,
    settleCountdownSeconds: null,
    onOpenVotePress: jest.fn(),
    onOpenQuestPress: jest.fn(),
    onProposeTeamPress: jest.fn(),
    onLadyAcknowledgePress: jest.fn(),
    onLadyResultPress: jest.fn(),
    onEarlyStrikePress: jest.fn(),
    strikePickMode: false,
    onCancelEarlyStrikePress: jest.fn(),
    hostManagement: null,
    canControlBots: true,
    releaseBot: jest.fn(),
  };
  const overrides: Partial<AvalonRoomShellModelInput> =
    viewer === 'host'
      ? {}
      : viewer === 'seated'
        ? {
            userId: seatUser(seatedSeat),
            isHost: false,
            mySeat: seatedSeat,
            effectiveSeat: seatedSeat,
            canControlBots: false,
          }
        : {
            userId: 'spectator',
            isHost: false,
            mySeat: null,
            effectiveSeat: null,
            canControlBots: false,
          };
  return createAvalonRoomShellModel({ ...base, ...overrides }).bottomActions.message;
}

function expectCell(phase: keyof typeof AVALON_GUIDANCE_MATRIX, state: AvalonState) {
  for (const viewer of ['host', 'seated', 'spectator'] as const) {
    const cell = AVALON_GUIDANCE_MATRIX[phase][viewer];
    const message = bottomMessage(state, viewer);
    if (cell.kind === 'message') {
      if (typeof message !== 'string' || message === '') {
        throw new Error(
          `${phase} x ${viewer}: declared a message cell, got ${JSON.stringify(message)}`,
        );
      }
    } else if (message !== null) {
      throw new Error(
        `${phase} x ${viewer}: declared exempt (${cell.reason}), got ${JSON.stringify(message)}`,
      );
    }
  }
}

describe('AVALON_GUIDANCE_MATRIX', () => {
  it('covers exactly the engine phase list, each cell message or exempt with a reason', () => {
    expect(Object.keys(AVALON_GUIDANCE_MATRIX).sort()).toEqual([...AVALON_PHASES].sort());
    for (const row of Object.values(AVALON_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('lobby: seated players wait for the host to deal', () => {
    const s = session(5);
    expect(s.state.phase.kind).toBe('lobby');
    expectCell('lobby', s.state);
  });

  it('viewing: unviewed seated viewers get the self hint', () => {
    const s = session(5);
    startViewing(s);
    expectCell('viewing', s.state);
  });

  it('night: waiting viewers are told whose confirmation is pending', () => {
    const s = session(5);
    beginNight(s);
    // A participant who has not confirmed yet legitimately has no
    // message (their confirm action is the guidance); confirm the two
    // probed seats first so the probe reads the waiting state the cell
    // declares. Non-participants reject the confirm and already wait.
    s.trySend({ type: 'avalon.night.confirm' }, seatUser(0));
    s.trySend({ type: 'avalon.night.confirm' }, seatUser(2));
    if (s.state.isAudioPlaying) s.send({ type: 'avalon.audio.ack' }, 'host');
    expect(s.state.phase.kind).toBe('night');
    expectCell('night', s.state);
  });

  it('nominate: leader instruction and waiting sentence both land', () => {
    const s = session(5);
    beginNight(s);
    completeNight(s);
    expectCell('nominate', s.state);
  });

  it('vote: voters are carried by the ballot button, spectators are told why', () => {
    const s = session(5);
    beginNight(s);
    completeNight(s);
    if (s.state.phase.kind !== 'nominate') throw new Error('expected nominate');
    const required = s.state.phase.requiredSize;
    const team: number[] = [s.state.leaderSeat];
    for (let seat = 0; team.length < required; seat += 1) {
      if (!team.includes(seat)) team.push(seat);
    }
    proposeTeam(s, team);
    expectCell('vote', s.state);
    // Post-ballot the seated cell flips to the cast-count sentence.
    s.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(2));
    expect(bottomMessage(s.state, 'seated')).toContain('已投');
  });

  it('quest: team members are carried by the play button, others wait', () => {
    const s = session(5);
    beginNight(s);
    completeNight(s);
    // Team of seats 0 and 2 so both probed seated viewers are members.
    proposeTeam(s, [0, 2]);
    approveTeam(s);
    expectCell('quest', s.state);
    // A non-member seated viewer gets the waiting sentence instead.
    expect(bottomMessage(s.state, 'seated', 3)).toBe('等待队员出牌…');
  });

  it('lady: holder, target and bystanders all read the public progress', () => {
    const s = session(9);
    beginNight(s);
    completeNight(s);
    playQuestRound(s);
    playQuestRound(s);
    expect(s.state.phase.kind).toBe('lady');
    expectCell('lady', s.state);
  });

  it('assassin and ended: the endgame sentences land per viewer', () => {
    const s = session(5);
    beginNight(s);
    completeNight(s);
    playQuestRound(s);
    playQuestRound(s);
    playQuestRound(s);
    expect(s.state.phase.kind).toBe('assassin');
    expectCell('assassin', s.state);
    const assassinSeat = Number(
      Object.entries(s.state.roles).find(([, roleId]) => roleId === 'assassin')?.[0],
    );
    // The accusation target must come from the dealt roles: dealing is truly
    // random, so a hardcoded seat can be the assassin's own seat, which the
    // engine rightly rejects as a self-accusation.
    const merlinSeat = Number(
      Object.entries(s.state.roles).find(([, roleId]) => roleId === 'merlin')?.[0],
    );
    s.send({ type: 'avalon.assassin.accuse', seat: merlinSeat }, seatUser(assassinSeat));
    expect(s.state.phase.kind).toBe('ended');
    expectCell('ended', s.state);
  });
});

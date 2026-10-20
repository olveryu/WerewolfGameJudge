/**
 * 返回房间不重弹结算揭晓（回归钉）：房间屏以含既存结算的中局快照挂载时，
 * 投票 / 任务 / 湖仙三面板都不得出现——那些结算在进房前就已存在，只作
 * 水位基线。只有挂载之后新发生的结算才弹一次；关闭后同一快照重渲染不
 * 再弹。湖仙结果可用底部「查验结果」按钮主动重看（设计内行为，不误伤）。
 *
 * 状态一律经真实引擎命令驱动（createInitialState + 公开命令），快照经
 * 可变 fake session 推送，与生产订阅路径同形。
 */
import {
  avalonEngine,
  type AvalonPlayerCount,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isBotSeat,
} from '@game-judge/game-engine/games/avalon/public';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Animated } from 'react-native';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';

import type { AvalonRoomSession } from '../../model/AvalonRoomSession';
import { AvalonRoomScreen } from '../AvalonRoomScreen';

let mockAuthUserId = 'host';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: mockAuthUserId, avatarUrl: null, equippedEffect: null },
    loading: false,
  }),
}));

jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

// The deadline hook only ticks while the app is foregrounded (same
// mock as the useStageDeadline suite).
jest.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

// Recent-room bookkeeping is a storage side effect outside this suite's scope.
jest.mock('@/features/room/services/recentRooms', () => ({
  addRecentRoom: jest.fn(),
}));

const DRIVE_NOW = 1_800_000_000_000;
const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

interface DrivenGame {
  readonly state: AvalonState;
  actAs: (seat: number, command: AvalonPublicCommand) => void;
  send: (command: AvalonPublicCommand, userId?: string) => void;
}

/** Real engine drive to the nominate phase: humans take seats, the rest are bots. */
function drivenGame(numberOfPlayers: AvalonPlayerCount, botSeats: readonly number[]): DrivenGame {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers },
    { roomCode: '1234', hostUserId: 'host', nowMs: DRIVE_NOW, commandId: 'create' },
  );
  const apply = (command: AvalonPublicCommand, userId: string, controlledSeat: number | null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: DRIVE_NOW,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  const send = (command: AvalonPublicCommand, userId = 'host') => apply(command, userId, null);
  /** Acts for one seat: bot seats are driven through the host takeover channel. */
  const actAs = (seat: number, command: AvalonPublicCommand) => {
    if (isBotSeat(state.roster, seat)) apply(command, 'host', seat);
    else apply(command, seatUser(seat), null);
  };
  const humanSeats: number[] = [];
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    if (!botSeats.includes(seat)) humanSeats.push(seat);
  }
  for (const seat of humanSeats) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (botSeats.length > 0) send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.roles.assign' });
  for (const seat of humanSeats) send({ type: 'avalon.role.viewed' }, seatUser(seat));
  if (botSeats.length > 0) send({ type: 'avalon.bots.markAllBotsViewed' });
  send({ type: 'avalon.game.begin' });
  const ackAudio = () => {
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' });
  };
  ackAudio();
  while (state.phase.kind === 'night') {
    for (const seat of getAvalonNightParticipants(state.roles, state.phase.step)) {
      actAs(seat, { type: 'avalon.night.confirm' });
    }
    ackAudio();
  }
  return {
    get state() {
      return state;
    },
    actAs,
    send,
  };
}

/** Current leader proposes the first requiredSize seats; everyone casts `ballot`; host settles. */
function proposeAndSettleVote(game: DrivenGame, ballot: 'approve' | 'reject'): void {
  const phase = game.state.phase;
  if (phase.kind !== 'nominate') throw new Error(`expected nominate, got ${phase.kind}`);
  const seats = Array.from({ length: phase.requiredSize }, (_, index) => index);
  game.actAs(game.state.leaderSeat, { type: 'avalon.team.updateDraft', seats });
  game.actAs(game.state.leaderSeat, { type: 'avalon.team.propose' });
  const count = game.state.config.numberOfPlayers;
  for (let seat = 0; seat < count; seat += 1) {
    game.actAs(seat, { type: 'avalon.team.vote', vote: ballot });
  }
  game.send({ type: 'avalon.vote.finish' });
}

/** Every team member plays success; host settles the quest. */
function playQuestAndSettle(game: DrivenGame): void {
  const phase = game.state.phase;
  if (phase.kind !== 'quest') throw new Error(`expected quest, got ${phase.kind}`);
  for (const seat of phase.teamSeats) {
    game.actAs(seat, { type: 'avalon.quest.play', play: 'success' });
  }
  game.send({ type: 'avalon.quest.finish' });
}

/** 5-player game after round 1: quest settled, back at nominate with the approval still projected. */
function midGameAfterFirstQuest(): DrivenGame {
  const game = drivenGame(5, []);
  proposeAndSettleVote(game, 'approve');
  playQuestAndSettle(game);
  const phase = game.state.phase;
  if (phase.kind !== 'nominate' || game.state.questHistory.length !== 1) {
    throw new Error('expected nominate with one settled quest');
  }
  if (game.state.lastVoteResult === null) throw new Error('expected a projected vote result');
  return game;
}

const successOutcome = {
  kind: 'decided',
  decision: { kind: 'committed', outcome: { kind: 'success' } },
} as const;

const ROOM: RoomRecord<'avalon'> = {
  roomCode: '1234',
  roomId: 'room-1234',
  gameType: 'avalon',
  hostUserId: 'host',
  createdAt: new Date(DRIVE_NOW),
};

/** Fake session whose snapshot can be replaced mid-test, notifying subscribers like production. */
function createMutableSession(initialState: AvalonState, userId: string) {
  let state = initialState;
  let revision = 0;
  const listeners = new Set<() => void>();
  const buildSnapshot = () => {
    revision += 1;
    return {
      epoch: 1,
      phase: 'ready',
      connection: 'live',
      pendingCommandCount: 0,
      lastRecoveredCommandRejection: null,
      identity: {
        room: {
          roomCode: '1234',
          roomId: 'room-1234',
          gameType: 'avalon',
          hostUserId: 'host',
          createdAt: new Date(DRIVE_NOW),
        },
        userId,
      },
      lastCommand: null,
      error: null,
      snapshot: { gameType: 'avalon', stateVersion: 6, revision, state },
    } as const;
  };
  let snapshot = buildSnapshot();
  const session = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: jest.fn(async () => successOutcome),
    dispatchPrepared: jest.fn(async () => successOutcome),
    prepare: jest.fn(() => {
      throw new Error('prepare is not used by these scenarios');
    }),
    connect: jest.fn(async () => ({ kind: 'connected' })),
    reconnect: jest.fn(async () => ({ kind: 'connected' })),
    disconnect: jest.fn(),
    acknowledgeRecoveredCommandRejection: jest.fn(),
  };
  return {
    session: session as unknown as AvalonRoomSession,
    push(nextState: AvalonState) {
      state = nextState;
      snapshot = buildSnapshot();
      for (const listener of listeners) listener();
    },
  };
}

function screenElement(session: AvalonRoomSession) {
  const props = {
    room: ROOM,
    entryReason: null,
    navigation: { navigate: jest.fn() },
    session,
    audio: {
      preload: jest.fn(async () => undefined),
      playEffect: jest.fn(async () => undefined),
      stopNarration: jest.fn(),
    },
  } as unknown as ComponentProps<typeof AvalonRoomScreen>;
  return <AvalonRoomScreen {...props} />;
}

/** Pushes a snapshot inside an async act so passive effects (panel message
 * animations) flush against the live tree before the next interaction. */
async function pushState(push: (nextState: AvalonState) => void, nextState: AvalonState) {
  await act(async () => {
    push(nextState);
  });
}

describe('AvalonRoomScreen reveal replay guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(DRIVE_NOW);
    mockAuthUserId = 'host';
    // The bottom panel's message fade runs Animated with the native driver;
    // react-test-renderer has no native node for it ("Unable to find node on
    // an unmounted component") when the message changes across snapshot
    // pushes. Neutralize the animation in this suite only — the watermark
    // behavior under test does not depend on it.
    const inertAnimation = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'timing').mockImplementation(() => inertAnimation);
    jest.spyOn(Animated, 'parallel').mockImplementation(() => inertAnimation);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not replay the vote or quest result when entering mid-game', () => {
    const game = midGameAfterFirstQuest();
    const { session } = createMutableSession(game.state, 'host');
    const { queryByTestId, unmount } = render(screenElement(session));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();
    unmount();
  });

  it('reveals a vote settled after entry exactly once', async () => {
    const game = midGameAfterFirstQuest();
    const { session, push } = createMutableSession(game.state, 'host');
    const { queryByTestId, getByTestId, rerender } = render(screenElement(session));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();

    proposeAndSettleVote(game, 'reject');
    await pushState(push, game.state);
    expect(getByTestId('avalon-vote-result-panel')).toBeTruthy();

    fireEvent.press(getByTestId('avalon-vote-result-close'));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();

    rerender(screenElement(session));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
  });

  it('reveals vote and quest settlements after entry in snapshot order, each exactly once', async () => {
    const game = midGameAfterFirstQuest();
    const { session, push } = createMutableSession(game.state, 'host');
    const { queryByTestId, getByTestId } = render(screenElement(session));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();

    proposeAndSettleVote(game, 'approve');
    await pushState(push, game.state);
    expect(getByTestId('avalon-vote-result-panel')).toBeTruthy();
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();
    fireEvent.press(getByTestId('avalon-vote-result-close'));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();

    playQuestAndSettle(game);
    await pushState(push, game.state);
    expect(getByTestId('avalon-quest-result-panel')).toBeTruthy();
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
    fireEvent.press(getByTestId('avalon-quest-result-close'));
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();

    await pushState(push, game.state);
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();
  });

  it('does not replay any of the three results when entering with all of them projected', async () => {
    // 9-player game: lady of the lake activates after quests 2-4, so this
    // snapshot carries a vote result, two quest entries and a lady result.
    const game = drivenGame(9, []);
    proposeAndSettleVote(game, 'approve');
    playQuestAndSettle(game);
    proposeAndSettleVote(game, 'approve');
    playQuestAndSettle(game);
    if (game.state.phase.kind !== 'lady') throw new Error('expected the lady phase');
    const holderSeat = game.state.phase.holderSeat;
    const targetSeat = (holderSeat + 1) % 9;
    game.actAs(holderSeat, { type: 'avalon.lady.check', seat: targetSeat });
    game.actAs(targetSeat, { type: 'avalon.lady.acknowledge' });
    if (game.state.lastLadyCheck === null) throw new Error('expected a lady check result');
    if (game.state.lastVoteResult === null) throw new Error('expected a projected vote result');
    if (game.state.questHistory.length !== 2) throw new Error('expected two settled quests');

    mockAuthUserId = seatUser(holderSeat);
    const { session, push } = createMutableSession(game.state, mockAuthUserId);
    const { queryByTestId, getByTestId } = render(screenElement(session));
    expect(queryByTestId('avalon-vote-result-panel')).toBeNull();
    expect(queryByTestId('avalon-quest-result-panel')).toBeNull();
    expect(queryByTestId('avalon-lady-result-modal')).toBeNull();

    // 设计内主动重看：底部「查验结果」按钮强制重弹，关闭后不再出现。
    fireEvent.press(getByTestId('avalon-lady-result-open'));
    expect(getByTestId('avalon-lady-result-modal')).toBeTruthy();
    fireEvent.press(getByTestId('avalon-lady-result-close'));
    expect(queryByTestId('avalon-lady-result-modal')).toBeNull();
    await pushState(push, game.state);
    expect(queryByTestId('avalon-lady-result-modal')).toBeNull();
  });

  it('reveals a lady result produced after entry', async () => {
    const game = drivenGame(9, []);
    proposeAndSettleVote(game, 'approve');
    playQuestAndSettle(game);
    proposeAndSettleVote(game, 'approve');
    playQuestAndSettle(game);
    if (game.state.phase.kind !== 'lady') throw new Error('expected the lady phase');
    const holderSeat = game.state.phase.holderSeat;
    const targetSeat = (holderSeat + 1) % 9;

    mockAuthUserId = seatUser(holderSeat);
    const { session, push } = createMutableSession(game.state, mockAuthUserId);
    const { queryByTestId, getByTestId } = render(screenElement(session));
    expect(queryByTestId('avalon-lady-result-modal')).toBeNull();

    game.actAs(holderSeat, { type: 'avalon.lady.check', seat: targetSeat });
    game.actAs(targetSeat, { type: 'avalon.lady.acknowledge' });
    await pushState(push, game.state);
    expect(getByTestId('avalon-lady-result-modal')).toBeTruthy();
    fireEvent.press(getByTestId('avalon-lady-result-close'));
    expect(queryByTestId('avalon-lady-result-modal')).toBeNull();
  });
});

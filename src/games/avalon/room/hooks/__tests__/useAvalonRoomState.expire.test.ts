/**
 * Client countdown-expiry wiring: when an armed vote/quest deadline
 * passes, an uncontrolled, idle client dispatches the matching public
 * timeout command. This dispatch is only an acceleration path — the
 * server settles on schedule through the avalon.settle.due effect —
 * but the wiring itself had no coverage since it was introduced, and
 * its gates (pending commands, bot takeover) decide whether the
 * acceleration fires at all.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isBotSeat,
} from '@game-judge/game-engine/games/avalon/public';
import { act, renderHook } from '@testing-library/react-native';

import type { AvalonRoomSession } from '../../../model/AvalonRoomSession';
import { useAvalonRoomState } from '../useAvalonRoomState';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'host', avatarUrl: null, equippedEffect: null },
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

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

/** Fixed clock for the whole drive: the armed deadline lands 5s after it. */
const DRIVE_NOW = 1_800_000_000_000;
const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

interface DrivenGame {
  state: AvalonState;
  actAs: (seat: number, command: AvalonPublicCommand) => void;
  send: (command: AvalonPublicCommand, userId?: string) => void;
}

/** Real engine drive to the nominate phase: 3 humans + 2 bots, or 5 humans. */
function drivenGame(withBots: boolean): DrivenGame {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
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
  const humanSeats = withBots ? [0, 1, 2] : [0, 1, 2, 3, 4];
  for (const seat of humanSeats) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  if (withBots) send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.game.start' });
  for (const seat of humanSeats) send({ type: 'avalon.role.viewed' }, seatUser(seat));
  if (withBots) send({ type: 'avalon.bots.markAllBotsViewed' });
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

function armedVoteState(withBots: boolean): AvalonState {
  const game = drivenGame(withBots);
  game.actAs(game.state.leaderSeat, { type: 'avalon.team.propose', seats: [0, 1] });
  for (let seat = 0; seat < 5; seat += 1) {
    game.actAs(seat, { type: 'avalon.team.vote', vote: 'approve' });
  }
  if (game.state.phase.kind !== 'vote' || game.state.phase.deadlineAt !== DRIVE_NOW + 5000) {
    throw new Error('expected an armed vote countdown');
  }
  return game.state;
}

function armedQuestState(): AvalonState {
  const game = drivenGame(false);
  game.actAs(game.state.leaderSeat, { type: 'avalon.team.propose', seats: [0, 1] });
  for (let seat = 0; seat < 5; seat += 1) {
    game.actAs(seat, { type: 'avalon.team.vote', vote: 'approve' });
  }
  game.send({ type: 'avalon.vote.finish' });
  game.actAs(0, { type: 'avalon.quest.play', play: 'success' });
  game.actAs(1, { type: 'avalon.quest.play', play: 'success' });
  if (game.state.phase.kind !== 'quest' || game.state.phase.deadlineAt !== DRIVE_NOW + 5000) {
    throw new Error('expected an armed quest countdown');
  }
  return game.state;
}

const successOutcome = {
  kind: 'decided',
  decision: { kind: 'committed', outcome: { kind: 'success' } },
} as const;

function createFakeSession(state: AvalonState, pendingCommandCount = 0) {
  const dispatch = jest.fn(async () => successOutcome);
  // useSyncExternalStore requires a stable snapshot reference across renders.
  const snapshot = {
    epoch: 1,
    phase: 'ready',
    connection: 'live',
    pendingCommandCount,
    lastRecoveredCommandRejection: null,
    identity: { room: { roomCode: '1234' }, userId: 'host' },
    lastCommand: null,
    error: null,
    snapshot: { gameType: 'avalon', stateVersion: 5, revision: 1, state },
  } as const;
  const session = {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    dispatch,
    dispatchPrepared: jest.fn(async () => successOutcome),
    prepare: jest.fn(() => {
      throw new Error('prepare is not used by these scenarios');
    }),
    connect: jest.fn(async () => ({ kind: 'connected' })),
    reconnect: jest.fn(async () => ({ kind: 'connected' })),
    disconnect: jest.fn(),
    acknowledgeRecoveredCommandRejection: jest.fn(),
  };
  return { session: session as unknown as AvalonRoomSession, dispatch };
}

function renderRoomState(state: AvalonState, pendingCommandCount = 0) {
  const fake = createFakeSession(state, pendingCommandCount);
  const props = {
    session: fake.session,
    room: { roomCode: '1234' },
    navigation: { navigate: jest.fn() },
    entryController: {
      requestExit: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    },
    audio: {
      preload: jest.fn(async () => undefined),
      playEffect: jest.fn(async () => undefined),
      stopNarration: jest.fn(),
    },
  } as unknown as Parameters<typeof useAvalonRoomState>[0];
  const rendered = renderHook(() => useAvalonRoomState(props));
  return { ...rendered, dispatch: fake.dispatch };
}

describe('useAvalonRoomState countdown expiry wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(DRIVE_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispatches the vote timeout when the armed vote deadline passes', async () => {
    const { dispatch, unmount } = renderRoomState(armedVoteState(false));
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.vote.timeout' },
      expect.objectContaining({ controlledSeat: null, isRecoverable: true }),
    );
    unmount();
  });

  it('dispatches the quest timeout when the armed quest deadline passes', async () => {
    const { dispatch, unmount } = renderRoomState(armedQuestState());
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.quest.timeout' },
      expect.objectContaining({ controlledSeat: null, isRecoverable: true }),
    );
    unmount();
  });

  it('does not dispatch while another command is still pending', async () => {
    const { dispatch, unmount } = renderRoomState(armedVoteState(false), 1);
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'avalon.vote.timeout' }, expect.anything());
    unmount();
  });

  it('does not dispatch while the host is taking over a bot seat', async () => {
    const { result, dispatch, unmount } = renderRoomState(armedVoteState(true));
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(3);
    });
    expect(result.current.controlledSeat).toBe(3);
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'avalon.vote.timeout' }, expect.anything());
    unmount();
  });
});

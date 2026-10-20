/**
 * Nomination draft mirror wiring: the leader's own screen derives the
 * seat badges and the propose button's full-draft gate from the picking
 * mirror (pushed in through setNominationDraftOverride) so a tap shows
 * before the server echo, while the authoritative state and the
 * returned view model keep carrying the server draft. Draft dispatches
 * serialize through submitTeamDraft (the shared submission lock is
 * single-flight), and propose waits for the chain tail to settle.
 * States come from the real engine; the session is a fake dispatch.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomBottomButton } from '@/features/room/model/RoomBottomActions';
import { showErrorAlert } from '@/utils/alertPresets';

import type { AvalonRoomSession } from '../../../model/AvalonRoomSession';
import { useAvalonRoomState } from '../useAvalonRoomState';

const mockAuth = { currentUserId: 'host' };

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: mockAuth.currentUserId, avatarUrl: null, equippedEffect: null },
  }),
}));

jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

jest.mock('@/utils/alertPresets', () => {
  const actual = jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets');
  return { ...actual, showErrorAlert: jest.fn() };
});

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

const seatUserOf = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/**
 * Real engine walk into the nominate phase of a 5-player game. The
 * first leader is drawn by the engine, so tests seat the viewer by
 * seatUserOf(state.leaderSeat) instead of assuming the host leads.
 */
function nominateState(): AvalonState {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  const seatUser = seatUserOf;
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.roles.assign' });
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  }
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return state;
}

const successOutcome = {
  kind: 'decided',
  decision: { kind: 'committed', outcome: { kind: 'success' } },
} as const;

function createFakeSession(state: AvalonState, userId: string) {
  // Typed parameters so mock.calls carries the command (an untyped
  // jest.fn has an empty call tuple and fails tsc under
  // noUncheckedIndexedAccess when a test inspects the calls).
  const dispatch = jest.fn(
    async (_command: AvalonPublicCommand, _options: unknown) => successOutcome,
  );
  // useSyncExternalStore requires a stable snapshot reference across renders.
  const snapshot = {
    epoch: 1,
    phase: 'ready',
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    identity: { room: { roomCode: '1234' }, userId },
    lastCommand: null,
    error: null,
    snapshot: { gameType: 'avalon', stateVersion: 6, revision: 1, state },
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

function renderRoomState(state: AvalonState) {
  const fake = createFakeSession(state, mockAuth.currentUserId);
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

type RoomStateResult = ReturnType<typeof renderRoomState>['result'];

function findProposeAction(result: RoomStateResult): RoomBottomButton {
  const bottom = result.current.shellModel.bottomActions;
  if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
  const action = bottom.layout.primary.find(
    (candidate) => candidate.testID === 'avalon-nominate-submit',
  );
  if (action === undefined) throw new Error('propose action not found');
  return action;
}

describe('useAvalonRoomState nomination draft mirror', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUserId = 'host';
  });

  it('lights the 队员 badge from the mirror before any echo, state untouched', () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result } = renderRoomState(state);
    const picked = (state.leaderSeat + 1) % 5;
    // The server draft is still empty: no badge anywhere yet.
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toBeNull();
    act(() => {
      result.current.setNominationDraftOverride([picked]);
    });
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toEqual({
      label: '队员',
      tone: 'success',
    });
    // The authoritative state and the returned view model still carry
    // the (empty) server draft: the mirror only fed the derivation.
    const phase = result.current.state.phase;
    if (phase.kind !== 'nominate') throw new Error('expected nominate phase');
    expect(phase.draftSeats).toEqual([]);
    expect(result.current.viewModel?.draftSeats).toEqual([]);
    act(() => {
      result.current.setNominationDraftOverride(null);
    });
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toBeNull();
  });

  it('gates the propose button on the mirrored draft reaching full size', () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result } = renderRoomState(state);
    // Server draft is empty (0 of 2): the button stays disabled.
    expect(findProposeAction(result).isEnabled).toBe(false);
    act(() => {
      result.current.setNominationDraftOverride([state.leaderSeat, (state.leaderSeat + 1) % 5]);
    });
    expect(findProposeAction(result).isEnabled).toBe(true);
  });

  it('ignores the override for a non-leader viewer', () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf((state.leaderSeat + 2) % 5);
    const { result } = renderRoomState(state);
    const picked = (state.leaderSeat + 1) % 5;
    act(() => {
      result.current.setNominationDraftOverride([picked]);
    });
    // The picked seat is not in the server draft and this viewer does
    // not lead: the mirror is the leader's own affair and must not
    // leak — no badge, and no propose action is offered at all.
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toBeNull();
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
    expect(
      bottom.layout.primary.find((candidate) => candidate.testID === 'avalon-nominate-submit'),
    ).toBeUndefined();
  });

  it('serializes rapid draft dispatches instead of tripping the submission lock', async () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    const first: readonly number[] = [state.leaderSeat];
    const second: readonly number[] = [state.leaderSeat, (state.leaderSeat + 1) % 5];

    let resolveFirst!: (outcome: typeof successOutcome) => void;
    const firstSettled = new Promise<typeof successOutcome>((resolve) => {
      resolveFirst = resolve;
    });
    dispatch.mockImplementationOnce(() => firstSettled);

    let firstDispatch!: Promise<boolean>;
    let secondDispatch!: Promise<boolean>;
    act(() => {
      firstDispatch = result.current.submitTeamDraft(first);
      secondDispatch = result.current.submitTeamDraft(second);
    });
    // The second set must not go out while the first is in flight: the
    // shared submission lock refuses overlapping submits outright, so
    // an unserialized second tap would lose its whole set (and roll
    // the mirror back) instead of compounding on the first.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.updateDraft', seats: first },
      expect.objectContaining({ label: '更新草稿' }),
    );

    await act(async () => {
      resolveFirst(successOutcome);
      await firstDispatch;
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      { type: 'avalon.team.updateDraft', seats: second },
      expect.objectContaining({ label: '更新草稿' }),
    );
    await expect(firstDispatch).resolves.toBe(true);
    await expect(secondDispatch).resolves.toBe(true);
  });

  it('holds propose until the last in-flight draft dispatch settles', async () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    const team: readonly number[] = [state.leaderSeat, (state.leaderSeat + 1) % 5];
    act(() => {
      result.current.setNominationDraftOverride(team);
    });
    const proposeAction = findProposeAction(result);
    if (!proposeAction.isEnabled || proposeAction.onPress === undefined)
      throw new Error('propose action must be enabled with a full mirrored draft');
    const pressPropose = proposeAction.onPress;

    let resolveDraft!: (outcome: typeof successOutcome) => void;
    const draftSettled = new Promise<typeof successOutcome>((resolve) => {
      resolveDraft = resolve;
    });
    dispatch.mockImplementationOnce(() => draftSettled);
    let draftDispatch!: Promise<boolean>;
    act(() => {
      draftDispatch = result.current.submitTeamDraft(team);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.updateDraft', seats: team },
      expect.objectContaining({ label: '更新草稿' }),
    );

    // A propose press racing the in-flight draft must not dispatch yet.
    await act(async () => {
      pressPropose();
    });
    expect(
      dispatch.mock.calls.filter(([command]) => command.type === 'avalon.team.propose'),
    ).toHaveLength(0);

    await act(async () => {
      resolveDraft(successOutcome);
      await draftDispatch;
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.propose' },
      expect.objectContaining({ label: '提交队伍' }),
    );
    await expect(draftDispatch).resolves.toBe(true);
  });

  it('still dispatches propose after the in-flight draft dispatch is rejected', async () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    const team: readonly number[] = [state.leaderSeat, (state.leaderSeat + 1) % 5];
    act(() => {
      result.current.setNominationDraftOverride(team);
    });
    const proposeAction = findProposeAction(result);
    if (!proposeAction.isEnabled || proposeAction.onPress === undefined)
      throw new Error('propose action must be enabled with a full mirrored draft');
    const pressPropose = proposeAction.onPress;

    // The server refuses the draft write: the submission resolves
    // false and surfaces the failure, but the rejection must not
    // poison the chain tail that propose waits on.
    const rejectedOutcome = {
      kind: 'decided',
      decision: { kind: 'rejected', commandId: 'command:draft', reason: 'avalon_wrong_phase' },
    } as const;
    dispatch.mockImplementationOnce(
      async () => rejectedOutcome as unknown as typeof successOutcome,
    );
    let draftDispatch!: Promise<boolean>;
    act(() => {
      draftDispatch = result.current.submitTeamDraft(team);
    });
    await act(async () => {
      await draftDispatch;
    });
    await expect(draftDispatch).resolves.toBe(false);
    expect(showErrorAlert).toHaveBeenCalledWith('更新草稿失败', expect.any(String));
    expect(
      dispatch.mock.calls.filter(([command]) => command.type === 'avalon.team.propose'),
    ).toHaveLength(0);

    // Propose still goes out against the server draft; the engine's
    // own validation and failure presentation take it from there.
    await act(async () => {
      pressPropose();
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.propose' },
      expect.objectContaining({ label: '提交队伍' }),
    );
  });
});

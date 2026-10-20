/**
 * Takeover dispatch discipline (werewolf/undercover parity): while the
 * host controls a bot seat, host commands dispatch uncontrolled — the
 * platform host gate (resolveHostActorId) rejects controlled actors —
 * while seat actions dispatch with the controlled seat. In-game seat
 * taps that no pick handler consumes are silent no-ops (werewolf
 * SeatTapPolicy NOOP), never the seat-locked alert.
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

import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { showErrorAlert } from '@/utils/alertPresets';

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

jest.mock('@/utils/alertPresets', () => {
  const actual = jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets');
  return { ...actual, showErrorAlert: jest.fn() };
});

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

/** Real engine state: host + two humans seated, bots fill seats 3/4, game started. */
function viewingStateWithBots(): AvalonState {
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
  for (let seat = 0; seat < 3; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seat === 0 ? 'host' : `u${seat}`,
    );
  }
  send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.roles.assign' });
  return state;
}

/**
 * Real engine walk into nominate with the host at seat 0 and bots on
 * seats 1-4. Roles and the first leader are drawn from entropy (the
 * command seeds do not fix them), so the fixture re-draws until a bot
 * leads; every assertion keys off state.leaderSeat, never a fixed
 * seat. Bot night confirms go through the host with the bot seat as
 * the controlled seat, as in production.
 */
function nominateStateWithBotLeader(): AvalonState {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const state = buildNominateWithBots();
    if (isBotSeat(state.roster, state.leaderSeat)) return state;
  }
  throw new Error('no bot-led nominate state in 25 draws');
}

function buildNominateWithBots(): AvalonState {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (
    command: AvalonPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'P0' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.roles.assign' });
  send({ type: 'avalon.role.viewed' });
  send({ type: 'avalon.bots.markAllBotsViewed' });
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' });
  while (state.phase.kind === 'night') {
    const participants = getAvalonNightParticipants(state.roles, state.phase.step);
    for (const seat of participants) {
      if (isBotSeat(state.roster, seat)) send({ type: 'avalon.night.confirm' }, 'host', seat);
      else send({ type: 'avalon.night.confirm' });
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' });
  }
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return state;
}

const successOutcome = {
  kind: 'decided',
  decision: { kind: 'committed', outcome: { kind: 'success' } },
} as const;

function createFakeSession(state: AvalonState) {
  const dispatch = jest.fn(async () => successOutcome);
  // useSyncExternalStore requires a stable snapshot reference across renders.
  const snapshot = {
    epoch: 1,
    phase: 'ready',
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    identity: { room: { roomCode: '1234' }, userId: 'host' },
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
  const fake = createFakeSession(state);
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

function findHostAction(model: RoomHostManagementModel | null, label: string) {
  for (const section of model?.sections ?? []) {
    for (const action of section.actions) {
      if (action.label !== label) continue;
      if (!action.isEnabled) throw new Error(`host action is disabled: ${label}`);
      return action;
    }
  }
  throw new Error(`host action not found: ${label}`);
}

describe('useAvalonRoomState takeover dispatch discipline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches host commands uncontrolled and seat actions controlled while taking over', async () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    expect(result.current.controlledSeat).toBeNull();

    // Long-press bot seat 3 to take it over.
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(3);
    });
    expect(result.current.controlledSeat).toBe(3);

    // Host scaffold action: must reach the engine without the controlled
    // seat, or the platform host gate rejects it as "not the host".
    const markAction = findHostAction(result.current.shellModel.hostManagement, '标记机器人已查看');
    await act(async () => {
      markAction.onPress();
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.bots.markAllBotsViewed' },
      expect.objectContaining({ controlledSeat: null }),
    );

    // Seat action (view the controlled bot's role): must carry seat 3.
    dispatch.mockClear();
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in viewing');
    const viewRole = bottom.layout.ghost.find((action) => action.testID === 'avalon-view-role');
    if (viewRole === undefined || !viewRole.isEnabled)
      throw new Error('view-role action missing or disabled');
    await act(async () => {
      viewRole.onPress();
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.role.viewed' },
      expect.objectContaining({ controlledSeat: 3 }),
    );
  });

  it('keeps in-game seat taps silent when no pick handler consumes them', () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    act(() => {
      result.current.shellModel.seats.onSeatPress(1);
    });
    expect(showErrorAlert).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('alerts the seat reason for disabled in-game seats, matching werewolf policy', () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    act(() => {
      result.current.shellModel.seats.onSeatPress(1, '游戏进行中不能入座');
    });
    expect(showErrorAlert).toHaveBeenCalledWith('不可选择', '游戏进行中不能入座');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('useAvalonRoomState takeover nomination mirror', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mirrors picks and dispatches drafts as the taken-over bot leader', async () => {
    const state = nominateStateWithBotLeader();
    const { result, dispatch } = renderRoomState(state);
    const leaderSeat = state.leaderSeat;
    const picked = 0;
    const team: readonly number[] = [leaderSeat, picked];

    // The host's own seat does not lead: the picking mirror is keyed
    // on the effective seat, so the override stays inert here even
    // though it was pushed in.
    act(() => {
      result.current.setNominationDraftOverride(team);
    });
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toBeNull();

    // Take over the bot leader seat: the same override now derives
    // the leader's screen — badge and full-draft gate included.
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(leaderSeat);
    });
    expect(result.current.controlledSeat).toBe(leaderSeat);
    expect(result.current.shellModel.seats.source.getSeat(picked).statusBadge).toEqual({
      label: '队员',
      tone: 'success',
    });
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
    const propose = bottom.layout.primary.find(
      (action) => action.testID === 'avalon-nominate-submit',
    );
    if (propose === undefined) throw new Error('propose action not found under takeover');
    expect(propose.isEnabled).toBe(true);
    // The authoritative state and the returned view model still carry
    // the (empty) server draft: the mirror only fed the derivation.
    const phase = result.current.state.phase;
    if (phase.kind !== 'nominate') throw new Error('expected nominate phase');
    expect(phase.draftSeats).toEqual([]);
    expect(result.current.viewModel?.draftSeats).toEqual([]);

    // Draft dispatches go out under the controlled bot leader seat.
    let draftDispatch!: Promise<boolean>;
    act(() => {
      draftDispatch = result.current.submitTeamDraft(team);
    });
    await act(async () => {
      await draftDispatch;
    });
    await expect(draftDispatch).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.updateDraft', seats: team },
      expect.objectContaining({ controlledSeat: leaderSeat, label: '更新草稿' }),
    );
  });
});

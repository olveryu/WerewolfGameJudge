/**
 * Takeover dispatch discipline (werewolf/undercover parity): while the
 * host controls a bot seat, host commands dispatch uncontrolled — the
 * platform host gate (resolveHostActorId) rejects controlled actors —
 * while seat actions dispatch with the controlled seat. In-game seat
 * taps that no pick handler consumes are silent no-ops (werewolf
 * SeatTapPolicy NOOP), never the seat-locked alert.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
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
  const send = (command: AvalonCommand, userId = 'host') => {
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
  send({ type: 'avalon.game.start' });
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
      { type: 'avalon.role.markAllBotsViewed' },
      expect.objectContaining({ controlledSeat: null }),
    );

    // Seat action (view the controlled bot's role): must carry seat 3.
    dispatch.mockClear();
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'info') throw new Error('expected info bottom actions in viewing');
    const viewRole = bottom.actions.find((action) => action.testID === 'avalon-view-role');
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

import { act, renderHook } from '@testing-library/react-native';

import { ConnectionStatus } from '@/services/types/IGameFacade';

import type { RoomConnectionLifecycleFacade } from '../useRoomConnectionLifecycle';
import { useRoomConnectionLifecycle } from '../useRoomConnectionLifecycle';

interface TestState {
  value: number;
}

type StateListener = () => void;
type StatusListener = (status: ConnectionStatus) => void;

function createFacade(initialState: TestState | null): RoomConnectionLifecycleFacade<TestState> & {
  emitState: (state: TestState | null) => void;
  emitStatus: (status: ConnectionStatus) => void;
  stateListeners: Set<StateListener>;
  statusListeners: Set<StatusListener>;
  connect: jest.Mock<Promise<void>, [string, string]>;
  leave: jest.Mock<Promise<void>, []>;
  manualReconnect: jest.Mock<void, []>;
} {
  let state = initialState;
  const stateListeners = new Set<StateListener>();
  const statusListeners = new Set<StatusListener>();

  return {
    stateListeners,
    statusListeners,
    emitState: (nextState: TestState | null) => {
      state = nextState;
      stateListeners.forEach((listener) => listener());
    },
    emitStatus: (status: ConnectionStatus) => {
      statusListeners.forEach((listener) => listener(status));
    },
    subscribe: jest.fn((listener: StateListener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    }),
    getState: jest.fn(() => state),
    addConnectionStatusListener: jest.fn((listener: StatusListener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    }),
    connect: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
    leave: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    manualReconnect: jest.fn<void, []>(),
  };
}

describe('useRoomConnectionLifecycle', () => {
  it('subscribes to state and connects when userId is present', async () => {
    const facade = createFacade({ value: 1 });
    const onConnectError = jest.fn();
    const onLeaveError = jest.fn();
    const { result } = renderHook(() =>
      useRoomConnectionLifecycle({
        facade,
        roomCode: '1234',
        userId: 'user-1',
        onConnectError,
        onLeaveError,
      }),
    );

    expect(result.current.state).toEqual({ value: 1 });
    expect(facade.connect).toHaveBeenCalledWith('1234', 'user-1');

    await act(async () => {
      facade.emitState({ value: 2 });
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(onConnectError).not.toHaveBeenCalled();
  });

  it('does not connect before userId exists', () => {
    const facade = createFacade(null);
    renderHook(() =>
      useRoomConnectionLifecycle({
        facade,
        roomCode: '1234',
        userId: null,
        onConnectError: jest.fn(),
        onLeaveError: jest.fn(),
      }),
    );

    expect(facade.connect).not.toHaveBeenCalled();
  });

  it('updates connection status and forwards manual reconnect', () => {
    const facade = createFacade(null);
    const { result } = renderHook(() =>
      useRoomConnectionLifecycle({
        facade,
        roomCode: '1234',
        userId: 'user-1',
        onConnectError: jest.fn(),
        onLeaveError: jest.fn(),
      }),
    );

    act(() => {
      facade.emitStatus(ConnectionStatus.Live);
    });

    expect(result.current.connectionStatus).toBe(ConnectionStatus.Live);

    act(() => {
      result.current.manualReconnect();
    });

    expect(facade.manualReconnect).toHaveBeenCalledTimes(1);
  });

  it('leaves and unsubscribes on unmount', () => {
    const facade = createFacade(null);
    const { unmount } = renderHook(() =>
      useRoomConnectionLifecycle({
        facade,
        roomCode: '1234',
        userId: 'user-1',
        onConnectError: jest.fn(),
        onLeaveError: jest.fn(),
      }),
    );

    expect(facade.stateListeners.size).toBe(1);
    expect(facade.statusListeners.size).toBe(1);

    unmount();

    expect(facade.leave).toHaveBeenCalledTimes(1);
    expect(facade.stateListeners.size).toBe(0);
    expect(facade.statusListeners.size).toBe(0);
  });
});

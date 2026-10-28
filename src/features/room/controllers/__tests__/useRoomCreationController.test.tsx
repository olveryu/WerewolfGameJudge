/** Room creation and config-flow integration through real controllers and boundary test doubles. */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { DispatchOutcome } from '@/platform/realtime/types';
import {
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

jest.mock('@/utils/alertPresets', () => ({
  ...jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets'),
  showErrorAlert: jest.fn(),
}));

const mockUseServices = useServices as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useRoomCreationController', () => {
  it('delegates creation and exposes the mutation lifecycle', async () => {
    const room: RoomRecord = {
      roomCode: '2345',
      roomId: 'room-id-2345',
      gameType: 'fibking',
      hostUserId: 'host-user',
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
    };
    let resolveCreation: ((record: RoomRecord) => void) | undefined;
    const createRoom = jest.fn(
      () =>
        new Promise<RoomRecord>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
    const { result } = renderHook(() => useRoomCreationController(), {
      wrapper: createWrapper(),
    });

    let operation: Promise<RoomRecord> | undefined;
    act(() => {
      operation = result.current.createRoom({
        expectedHostUserId: 'host-user',
        gameType: 'fibking',
        config: { numberOfPlayers: 8 },
      });
    });
    await waitFor(() => expect(result.current.isCreating).toBe(true));
    if (resolveCreation === undefined || operation === undefined) {
      throw new Error('Missing room-creation operation');
    }
    resolveCreation(room);

    await expect(operation).resolves.toEqual(room);
    await waitFor(() => expect(result.current.isCreating).toBe(false));
    expect(createRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'host-user',
      gameType: 'fibking',
      config: { numberOfPlayers: 8 },
    });
  });
});

describe('useRoomConfigSubmission', () => {
  const state = testRoomState('demo');
  const room: RoomRecord = {
    roomCode: '2345',
    roomId: 'room-id-2345',
    gameType: 'demo',
    hostUserId: 'host-user',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
  };

  function createInput() {
    return {
      params: { mode: 'create' } as const,
      navigation: { replace: jest.fn(), popTo: jest.fn() } as unknown as Parameters<
        typeof useRoomConfigSubmission
      >[0]['navigation'],
      getFailureMessage: jest.fn(() => '当前状态不允许此操作'),
      createRequest: jest.fn(() => ({
        expectedHostUserId: 'host-user',
        gameType: 'demo' as const,
        config: { numberOfPlayers: 4 },
      })),
      updateConfig: jest.fn(async () => successfulRoomCommand(state, 'config-command')),
      creationLabel: '创建Demo房间',
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('keeps creation pending until success and replaces the config route', async () => {
    let resolveCreation: ((record: RoomRecord) => void) | undefined;
    const createRoom = jest.fn(
      () =>
        new Promise<RoomRecord>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
    const input = createInput();
    const { result } = renderHook(() => useRoomConfigSubmission(input), {
      wrapper: createWrapper(),
    });

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    expect(input.navigation.replace).not.toHaveBeenCalled();
    if (resolveCreation === undefined) throw new Error('Missing room-creation operation');
    resolveCreation(room);

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(createRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'host-user',
      gameType: 'demo',
      config: { numberOfPlayers: 4 },
    });
    expect(input.createRequest).toHaveBeenCalledTimes(1);
    expect(input.navigation.replace).toHaveBeenCalledWith('Room', {
      roomCode: '2345',
      entryReason: 'created',
    });
    expect(input.updateConfig).not.toHaveBeenCalled();
    expect(input.navigation.popTo).not.toHaveBeenCalled();
  });

  it('reports creation failure without navigating and releases the pending state', async () => {
    const error = new Error('Room creation failed');
    const createRoom = jest.fn().mockRejectedValue(error);
    mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
    const input = createInput();
    const { result } = renderHook(() => useRoomConfigSubmission(input), {
      wrapper: createWrapper(),
    });

    act(() => result.current.submit());
    await waitFor(() =>
      expect(handleError).toHaveBeenCalledWith(error, {
        label: '创建Demo房间',
        logger: configLog,
        alertMessage: '创建失败，请重试',
      }),
    );
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(input.navigation.replace).not.toHaveBeenCalled();
    expect(input.navigation.popTo).not.toHaveBeenCalled();
  });

  it('preserves synchronous game-owned creation preconditions', () => {
    const createRoom = jest.fn();
    mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
    const input = createInput();
    input.createRequest.mockImplementation(() => {
      throw new Error('Authentication required');
    });
    const { result } = renderHook(() => useRoomConfigSubmission(input), {
      wrapper: createWrapper(),
    });

    expect(() => result.current.submit()).toThrow('Authentication required');
    expect(createRoom).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'returns to the active room only after accepted edit: %s',
    async (isAccepted) => {
      const createRoom = jest.fn();
      mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
      const input = createInput();
      let resolveUpdate: ((outcome: DispatchOutcome<typeof state>) => void) | undefined;
      const updateConfig = jest.fn(
        () =>
          new Promise<DispatchOutcome<typeof state>>((resolve) => {
            resolveUpdate = resolve;
          }),
      );
      const { result } = renderHook(
        () =>
          useRoomConfigSubmission({
            ...input,
            params: { mode: 'edit', roomCode: '2345' },
            updateConfig,
          }),
        { wrapper: createWrapper() },
      );

      act(() => result.current.submit());
      expect(result.current.isSubmitting).toBe(true);
      expect(input.navigation.popTo).not.toHaveBeenCalled();
      if (resolveUpdate === undefined) throw new Error('Missing config-update operation');
      const outcome = isAccepted
        ? successfulRoomCommand(state, 'config-command')
        : rejectedRoomCommand<typeof state>('invalid_status', 'config-command');
      await act(async () => resolveUpdate!(outcome));

      expect(result.current.isSubmitting).toBe(false);
      expect(updateConfig).toHaveBeenCalledTimes(1);
      if (isAccepted) {
        expect(input.navigation.popTo).toHaveBeenCalledWith('Room', { roomCode: '2345' });
      } else {
        expect(input.navigation.popTo).not.toHaveBeenCalled();
        expect(input.getFailureMessage).toHaveBeenCalledWith(outcome);
      }
      expect(createRoom).not.toHaveBeenCalled();
      expect(input.createRequest).not.toHaveBeenCalled();
      expect(input.navigation.replace).not.toHaveBeenCalled();
    },
  );
});

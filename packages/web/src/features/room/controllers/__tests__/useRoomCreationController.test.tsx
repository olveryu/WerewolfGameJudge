/** Room creation and config-flow integration through real controllers and boundary test doubles. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type { NavigateOptions, To } from 'react-router';
import type { Mock } from 'vitest';

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

vi.mock('@/contexts/ServiceContext', () => ({ useServices: vi.fn() }));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

vi.mock('@/utils/alertPresets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alertPresets')>()),
  showErrorAlert: vi.fn(),
}));

const mockUseServices = useServices as Mock;

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
    const createRoom = vi.fn(
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
      navigate: vi.fn<(to: To | number, options?: NavigateOptions) => void>(),
      getFailureMessage: vi.fn(() => '当前状态不允许此操作'),
      createRequest: vi.fn(() => ({
        expectedHostUserId: 'host-user',
        gameType: 'demo' as const,
        config: { numberOfPlayers: 4 },
      })),
      updateConfig: vi.fn(async () => successfulRoomCommand(state, 'config-command')),
      creationLabel: '创建Demo房间',
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('keeps creation pending until success and replaces the config route', async () => {
    let resolveCreation: ((record: RoomRecord) => void) | undefined;
    const createRoom = vi.fn(
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
    expect(input.navigate).not.toHaveBeenCalled();
    if (resolveCreation === undefined) throw new Error('Missing room-creation operation');
    resolveCreation(room);

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(createRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'host-user',
      gameType: 'demo',
      config: { numberOfPlayers: 4 },
    });
    expect(input.createRequest).toHaveBeenCalledTimes(1);
    expect(input.navigate).toHaveBeenCalledTimes(1);
    expect(input.navigate).toHaveBeenCalledWith('/room/2345', {
      replace: true,
      state: { entryReason: 'created' },
    });
    expect(input.updateConfig).not.toHaveBeenCalled();
  });

  it('reports creation failure without navigating and releases the pending state', async () => {
    const error = new Error('Room creation failed');
    const createRoom = vi.fn().mockRejectedValue(error);
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
    expect(input.navigate).not.toHaveBeenCalled();
  });

  it('preserves synchronous game-owned creation preconditions', () => {
    const createRoom = vi.fn();
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
      const createRoom = vi.fn();
      mockUseServices.mockReturnValue({ roomCreator: { createRoom } });
      const input = createInput();
      let resolveUpdate: ((outcome: DispatchOutcome<typeof state>) => void) | undefined;
      const updateConfig = vi.fn(
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
      expect(input.navigate).not.toHaveBeenCalled();
      if (resolveUpdate === undefined) throw new Error('Missing config-update operation');
      const outcome = isAccepted
        ? successfulRoomCommand(state, 'config-command')
        : rejectedRoomCommand<typeof state>('invalid_status', 'config-command');
      await act(async () => resolveUpdate!(outcome));

      expect(result.current.isSubmitting).toBe(false);
      expect(updateConfig).toHaveBeenCalledTimes(1);
      if (isAccepted) {
        expect(input.navigate).toHaveBeenCalledWith('/room/2345', { replace: true });
      } else {
        expect(input.navigate).not.toHaveBeenCalled();
        expect(input.getFailureMessage).toHaveBeenCalledWith(outcome);
      }
      expect(createRoom).not.toHaveBeenCalled();
      expect(input.createRequest).not.toHaveBeenCalled();
    },
  );
});

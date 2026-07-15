import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';

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

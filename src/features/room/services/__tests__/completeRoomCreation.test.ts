import { completeRoomCreation } from '@/features/room/services/completeRoomCreation';
import { addRecentRoom } from '@/lib/recentRooms';

jest.mock('@/lib/recentRooms', () => ({ addRecentRoom: jest.fn() }));

describe('completeRoomCreation', () => {
  it('persists the confirmed room code before acknowledging the creation intent', () => {
    const acknowledgeRoomCreation = jest.fn();
    const record = {
      roomCode: '7777',
      roomId: 'room-id-7777',
      gameType: 'fibking' as const,
      hostUserId: 'host-1',
      createdAt: new Date(0),
      creationId: 'creation-id-7777',
    };

    expect(completeRoomCreation({ acknowledgeRoomCreation }, record)).toBe(record);
    expect(addRecentRoom).toHaveBeenCalledWith('7777');
    expect(acknowledgeRoomCreation).toHaveBeenCalledWith('creation-id-7777');
    expect((addRecentRoom as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeRoomCreation.mock.invocationCallOrder[0]!,
    );
  });
});

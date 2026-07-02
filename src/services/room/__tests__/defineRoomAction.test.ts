import { cfPost } from '@/services/cloudflare/cfFetch';

import { defineRoomAction, type RoomActionContext } from '../defineRoomAction';

jest.mock('@/services/cloudflare/cfFetch', () => ({
  cfPost: jest.fn(),
}));

function createCtx(roomCode = 'ABCD'): RoomActionContext {
  return {
    getRoomCode: () => roomCode,
  };
}

describe('defineRoomAction', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('posts roomCode plus body fields', async () => {
    jest.mocked(cfPost).mockResolvedValue({});
    const action = defineRoomAction<[seat: number]>({
      name: 'test.action',
      path: '/test/action',
      body: (seat) => ({ seat }),
    });

    const result = await action(createCtx(), 3);

    expect(result).toEqual({ success: true });
    expect(cfPost).toHaveBeenCalledWith('/test/action', { roomCode: 'ABCD', seat: 3 });
  });

  it('returns the server reason on request failure', async () => {
    jest.mocked(cfPost).mockRejectedValue({ reason: 'BAD_ACTION' });
    const action = defineRoomAction({
      name: 'test.action',
      path: '/test/action',
    });

    await expect(action(createCtx())).resolves.toEqual({
      success: false,
      reason: 'BAD_ACTION',
    });
  });

  it('lets getRoomCode fail fast before posting', async () => {
    const action = defineRoomAction({
      name: 'test.action',
      path: '/test/action',
    });
    const ctx: RoomActionContext = {
      getRoomCode: () => {
        throw new Error('not in room');
      },
    };

    await expect(action(ctx)).rejects.toThrow('not in room');
    expect(cfPost).not.toHaveBeenCalled();
  });
});

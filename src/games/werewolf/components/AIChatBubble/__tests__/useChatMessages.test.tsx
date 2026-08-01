import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomSessionSnapshot } from '@/features/room/session/types';
import { useChatMessages } from '@/games/werewolf/components/AIChatBubble/useChatMessages';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

describe('useChatMessages', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('rejects a stale room owner before changing chat or persistence state', async () => {
    const source = {
      getSnapshot: (): RoomSessionSnapshot<GameState> => ({
        phase: 'idle',
        epoch: 0,
        identity: null,
        connection: 'disconnected',
        snapshot: null,
        lastCommand: null,
        error: null,
      }),
    };
    const { result } = renderHook(() =>
      useChatMessages(source, true, { userId: 'user-1', roomId: 'room-1' }),
    );

    act(() => result.current.setInputText('分析当前局势'));
    await expect(result.current.handleSend()).rejects.toThrow(
      'AI chat owner does not match the active room session',
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.cooldownRemaining).toBe(0);
    expect(mockStoredValues.size).toBe(0);
  });
});

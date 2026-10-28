import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { useChatMessages } from '@/games/werewolf/components/AIChatBubble/useChatMessages';
import type { LinkSnapshot } from '@/platform/realtime/types';
import { idleLinkSnapshot } from '@/test-utils/linkSnapshot';

// The HTTP client reads token storage at import time, so the backing map must live inside the
// hoisted factory rather than in a module-level const (which would still be in its TDZ).
jest.mock('@/services/infra/localStorage', () => {
  const values = new Map<string, string>();
  return {
    mockStoredValues: values,
    storage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    },
  };
});
const { mockStoredValues } = jest.requireMock<{ mockStoredValues: Map<string, string> }>(
  '@/services/infra/localStorage',
);

describe('useChatMessages', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('rejects a stale room owner before changing chat or persistence state', async () => {
    const source = {
      getSnapshot: (): LinkSnapshot<GameState> => idleLinkSnapshot<GameState>(),
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

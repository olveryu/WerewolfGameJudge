import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';

import { useChatMessages } from '@/games/werewolf/components/AIChatBubble/useChatMessages';
import type { LinkSnapshot } from '@/platform/realtime/types';
import { idleLinkSnapshot } from '@/test-utils/linkSnapshot';

describe('useChatMessages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects a stale room owner before changing chat or persistence state', async () => {
    const source = {
      getSnapshot: (): LinkSnapshot<GameState> => idleLinkSnapshot<GameState>(),
    };
    const onReplySettled = vi.fn();
    const { result } = renderHook(() =>
      useChatMessages(source, true, { userId: 'user-1', roomId: 'room-1' }, onReplySettled),
    );

    act(() => result.current.setInputText('分析当前局势'));
    await expect(result.current.handleSend()).rejects.toThrow(
      'AI chat owner does not match the active room session',
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.cooldownRemaining).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(onReplySettled).not.toHaveBeenCalled();
  });
});

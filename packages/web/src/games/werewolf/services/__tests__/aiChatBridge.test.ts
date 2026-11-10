import { act, renderHook } from '@testing-library/react';

import {
  requestAIChatMessage,
  setAIChatBridgeListener,
  useAIChatAvailable,
} from '@/games/werewolf/services/aiChatBridge';

describe('aiChatBridge', () => {
  afterEach(() => {
    setAIChatBridgeListener(null);
  });

  it('reports availability while a chat listener is registered and forwards requests to it', () => {
    const { result } = renderHook(() => useAIChatAvailable());
    expect(result.current).toBe(false);

    const listener = vi.fn();
    act(() => setAIChatBridgeListener(listener));
    expect(result.current).toBe(true);

    requestAIChatMessage({ fullText: 'full', displayText: 'short', maxTokens: 10 });
    expect(listener).toHaveBeenCalledWith({
      fullText: 'full',
      displayText: 'short',
      maxTokens: 10,
    });

    act(() => setAIChatBridgeListener(null));
    expect(result.current).toBe(false);
  });

  it('fails fast on a request without a mounted chat', () => {
    expect(() => requestAIChatMessage({ fullText: 'full', displayText: 'short' })).toThrow(
      'AI chat request without a mounted AI chat',
    );
  });
});

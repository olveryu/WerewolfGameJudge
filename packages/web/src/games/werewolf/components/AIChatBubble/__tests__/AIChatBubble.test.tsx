import { render, screen } from '@testing-library/react';

import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { RoomIdentity } from '@/platform/realtime/types';

import { AIChatBubble } from '../AIChatBubble';
import { useAIChat } from '../useAIChat';

vi.mock('../useAIChat', () => ({ useAIChat: vi.fn() }));

const mockedUseAIChat = vi.mocked(useAIChat);

function renderChatButton({
  isLoading = false,
  cooldownRemaining = 0,
}: {
  readonly isLoading?: boolean;
  readonly cooldownRemaining?: number;
} = {}) {
  mockedUseAIChat.mockReturnValue({
    messages: [],
    inputText: '问题',
    setInputText: vi.fn(),
    isLoading,
    isStreaming: false,
    cooldownRemaining,
    handleSend: vi.fn(),
    handleQuickQuestion: vi.fn(),
    sendWithDisplay: vi.fn(),
    handleClearHistory: vi.fn(),
    contextQuestions: [],
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    bubble: {
      position: { x: 0, y: 0 },
      handleKeyDown: vi.fn(),
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      handlePointerCancel: vi.fn(),
      handleClick: vi.fn(),
    },
    keyboardHeight: 0,
  });

  render(
    <AIChatBubble
      session={{} as WerewolfRoomSession}
      identity={{} as RoomIdentity<'werewolf'>}
      triggerPulse={false}
    />,
  );
}

describe('AIChatBubble send button', () => {
  it('announces the send action when ready', () => {
    renderChatButton();

    expect(screen.getByRole('button', { name: '发送' })).toBeEnabled();
  });

  it('announces when a message is sending', () => {
    renderChatButton({ isLoading: true });

    expect(screen.getByRole('button', { name: '发送中' })).toBeDisabled();
  });

  it('announces the remaining cooldown', () => {
    renderChatButton({ cooldownRemaining: 3 });

    expect(screen.getByRole('button', { name: '发送，冷却中，剩余 3 秒' })).toBeDisabled();
  });
});

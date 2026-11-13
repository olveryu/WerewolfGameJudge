import { fireEvent, render, screen } from '@testing-library/react';

import { readAIChatBubblePosition } from '@/games/werewolf/services/aiChatBubblePositionStore';

import { getDefaultPosition } from '../bubbleLayout';
import { useBubbleDrag } from '../useBubbleDrag';

function BubbleDragHarness({ withAction = false }: { readonly withAction?: boolean }) {
  const bubble = useBubbleDrag(() => {}, 'user-1');
  return (
    <>
      {withAction && <button className="room-action">分享</button>}
      <div
        className="ai-chat-bubble-anchor"
        style={{ left: bubble.position.x, top: bubble.position.y }}
      >
        <button type="button" className="ai-chat-bubble" onKeyDown={bubble.handleKeyDown}>
          小助手
        </button>
      </div>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('innerWidth', 400);
  vi.stubGlobal('innerHeight', 800);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('moves and persists the bubble with an arrow key', () => {
  render(<BubbleDragHarness />);
  const bubble = screen.getByRole('button', { name: '小助手' });
  const anchor = bubble.parentElement;
  if (anchor === null) throw new Error('Bubble anchor is missing');
  const initialLeft = Number.parseFloat(anchor.style.left);

  fireEvent.keyDown(bubble, { key: 'ArrowLeft' });

  const nextLeft = Number.parseFloat(anchor.style.left);
  expect(nextLeft).toBe(initialLeft - 16);
  expect(readAIChatBubblePosition('user-1')?.x).toBe(nextLeft);
  expect(readAIChatBubblePosition('user-1')?.y).toBe(Number.parseFloat(anchor.style.top));
});

it('keeps the default bubble in its original position when controls overlap it', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('room-action')
      ? new DOMRect(300, 670, 90, 60)
      : new DOMRect(0, 0, 0, 0);
  });

  render(<BubbleDragHarness withAction />);

  const bubble = screen.getByRole('button', { name: '小助手' });
  const anchor = bubble.parentElement;
  if (anchor === null) throw new Error('Bubble anchor is missing');

  const expectedPosition = getDefaultPosition(400, 800);
  expect(anchor.style.left).toBe(`${expectedPosition.x}px`);
  expect(anchor.style.top).toBe(`${expectedPosition.y}px`);
});

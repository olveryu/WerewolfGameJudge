import { render, waitFor } from '@testing-library/react';

const playerMocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../components/drawGuessReactionPlayer', () => ({
  createDrawGuessReactionPlayer: vi.fn(() => ({
    enqueue: playerMocks.enqueue,
    dispose: playerMocks.dispose,
  })),
}));

import { DrawGuessReactionEffects } from '../components/DrawGuessReactionEffects';

const seats = [
  { seat: 0, displayName: '画手' },
  { seat: 1, displayName: '小满' },
  { seat: 2, displayName: '阿青' },
];

describe('DrawGuessReactionEffects', () => {
  beforeEach(() => {
    playerMocks.enqueue.mockClear();
    playerMocks.dispose.mockClear();
  });

  it('skips the starting snapshot and queues each newly accepted reaction with its sender', async () => {
    const { rerender } = render(
      <DrawGuessReactionEffects reactionsBySeat={{ 1: 'flower' }} seats={seats} />,
    );
    expect(playerMocks.enqueue).not.toHaveBeenCalled();

    rerender(
      <DrawGuessReactionEffects reactionsBySeat={{ 1: 'flower', 2: 'tomato' }} seats={seats} />,
    );

    await waitFor(() => {
      expect(playerMocks.enqueue).toHaveBeenCalledWith({ kind: 'tomato', sender: '阿青' });
    });
    expect(playerMocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('disposes the animation player when the canvas stage unmounts', () => {
    const { unmount } = render(<DrawGuessReactionEffects reactionsBySeat={{}} seats={seats} />);
    unmount();
    expect(playerMocks.dispose).toHaveBeenCalledTimes(1);
  });
});

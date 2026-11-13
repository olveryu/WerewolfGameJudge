import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawGuessReactionPicker } from '../components/DrawGuessReactionPicker';
import type { DrawGuessRoomScreenState } from '../hooks/useDrawGuessRoomState';

const seats = [
  { seat: 0, displayName: '画手' },
  { seat: 1, displayName: '小满' },
  { seat: 2, displayName: '阿青' },
];

function renderPicker({
  effectiveSeat = 1,
  controlledSeat = null,
  reactionsBySeat = {},
  drawerSeat = 0,
}: {
  readonly effectiveSeat?: number | null;
  readonly controlledSeat?: number | null;
  readonly reactionsBySeat?: Readonly<Record<number, 'flower' | 'egg' | 'tomato'>>;
  readonly drawerSeat?: number;
} = {}) {
  const submit = vi.fn<DrawGuessRoomScreenState['submit']>().mockResolvedValue(true);
  render(
    <DrawGuessReactionPicker
      drawerSeat={drawerSeat}
      reactionsBySeat={reactionsBySeat}
      seats={seats}
      effectiveSeat={effectiveSeat}
      controlledSeat={controlledSeat}
      isSubmitting={false}
      phaseRevision={7}
      turnIndex={3}
      submit={submit}
    />,
  );
  return submit;
}

describe('DrawGuessReactionPicker', () => {
  it('sends one reaction with the current phase and turn, preserving host takeover', async () => {
    const user = userEvent.setup();
    const submit = renderPicker({ effectiveSeat: 2, controlledSeat: 2 });

    await user.click(screen.getByRole('button', { name: '送鲜花' }));

    expect(submit).toHaveBeenCalledWith(
      '送出鲜花',
      {
        type: 'drawguess.reaction.send',
        phaseRevision: 7,
        turnIndex: 3,
        reaction: 'flower',
      },
      { controlledSeat: 2 },
    );
  });

  it('prevents a second reaction and shows the named sender', () => {
    renderPicker({ reactionsBySeat: { 1: 'egg' } });

    expect(screen.getByRole('button', { name: '送鲜花' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '已送鸡蛋' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '已送鸡蛋' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('list', { name: '送出互动的玩家' })).toHaveTextContent('小满 送出鸡蛋');
  });

  it('does not allow the drawing seat to react to their own turn', () => {
    renderPicker({ effectiveSeat: 0 });

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
      true,
    );
  });
});

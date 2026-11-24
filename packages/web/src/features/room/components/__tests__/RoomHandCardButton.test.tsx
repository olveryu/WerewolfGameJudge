import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RoomHandCard } from '../../model/RoomHand';
import { RoomHandCardButton } from '../RoomHandCardButton';

const press = vi.fn();
const blocked = vi.fn();

function card(state: RoomHandCard['state']): RoomHandCard {
  return {
    id: 'action:test',
    label: '行动',
    accessibleLabel: null,
    category: 'player',
    actionKey: 'test',
    icon: 'hand-left-outline',
    state,
    isPending: false,
    opensDialog: false,
    testID: undefined,
    containedActionTestIDs: [],
  };
}

describe('RoomHandCardButton', () => {
  beforeEach(() => {
    press.mockReset();
    blocked.mockReset();
  });

  it('explains a blocked action without running it, including on keyboard activation', async () => {
    const user = userEvent.setup();
    render(
      <RoomHandCardButton card={card({ kind: 'blocked', reason: null })} onBlocked={blocked} />,
    );
    const button = screen.getByRole('button', { name: '行动' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('当前暂不可用');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(blocked).toHaveBeenCalledWith('当前暂不可用');
    expect(press).not.toHaveBeenCalled();
  });

  it('keeps a busy card focusable but inert, then executes it once ready', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RoomHandCardButton card={card({ kind: 'busy' })} onBlocked={blocked} />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(press).not.toHaveBeenCalled();
    expect(blocked).not.toHaveBeenCalled();
    rerender(
      <RoomHandCardButton card={card({ kind: 'ready', onPress: press })} onBlocked={blocked} />,
    );
    await user.click(screen.getByRole('button', { name: '行动' }));
    expect(press).toHaveBeenCalledOnce();
  });

  it('shows an action-provided blocked reason on the card', () => {
    render(
      <RoomHandCardButton
        card={{ ...card({ kind: 'blocked', reason: '本夜无法袭击' }), showBlockedReason: true }}
        onBlocked={blocked}
      />,
    );
    const button = screen.getByRole('button', { name: '行动' });
    expect(button).toHaveAccessibleDescription('本夜无法袭击');
    expect(screen.getByText('本夜无法袭击')).toBeVisible();
  });
});

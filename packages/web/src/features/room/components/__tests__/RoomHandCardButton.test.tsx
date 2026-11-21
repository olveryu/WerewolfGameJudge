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

  it('uses a native disabled busy control and executes a ready action', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RoomHandCardButton card={card({ kind: 'busy' })} onBlocked={blocked} />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    rerender(
      <RoomHandCardButton card={card({ kind: 'ready', onPress: press })} onBlocked={blocked} />,
    );
    await user.click(screen.getByRole('button', { name: '行动' }));
    expect(press).toHaveBeenCalledOnce();
  });
});

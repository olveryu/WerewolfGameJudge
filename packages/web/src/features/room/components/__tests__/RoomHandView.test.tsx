import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RoomHand } from '@/features/room/model/RoomHand';

import { RoomActionHand } from '../RoomActionHand';

it('focuses a group return card and returns on Escape', async () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  const hand: RoomHand = {
    face: { kind: 'group', key: 'night-step' },
    label: '预言家行动',
    cards: [
      {
        id: 'group:night-step:back',
        label: '返回',
        accessibleLabel: null,
        icon: 'arrow-back',
        category: 'back',
        actionKey: null,
        state: { kind: 'ready', onPress: onBack },
        isPending: false,
        opensDialog: false,
        testID: 'group-back',
        containedActionTestIDs: [],
      },
    ],
  };
  render(
    <RoomActionHand
      hand={hand}
      focusCardId="group:night-step:back"
      onFocusTargetSettled={vi.fn()}
      onBack={onBack}
    />,
  );
  const back = screen.getByRole('button', { name: '返回' });
  expect(back).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(onBack).toHaveBeenCalledOnce();
});

it('settles a focus target whose card is absent so a later card with that id stays unfocused', () => {
  const onFocusTargetSettled = vi.fn();
  const hand: RoomHand = { face: { kind: 'main' }, label: '行动', cards: [] };
  render(
    <RoomActionHand
      hand={hand}
      focusCardId="action:startSeatSelection"
      onFocusTargetSettled={onFocusTargetSettled}
      onBack={vi.fn()}
    />,
  );
  expect(onFocusTargetSettled).toHaveBeenCalledOnce();
});

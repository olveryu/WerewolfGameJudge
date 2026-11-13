import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';

function renderBoardPicker() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <BoardPickerScreen exitPath="/" onSelect={() => {}} onCustom={() => {}} />,
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('BoardPickerScreen', () => {
  it('gives the board search an accessible name', async () => {
    const user = userEvent.setup();
    renderBoardPicker();

    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(screen.getByRole('searchbox', { name: '搜索模板或角色' })).toHaveFocus();
  });

  it('searches across categories while the category controls are hidden', async () => {
    const user = userEvent.setup();
    renderBoardPicker();

    await user.click(screen.getByRole('button', { name: '搜索' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索模板或角色' }), '狼女孩');

    expect(await screen.findByRole('region', { name: '特色 · 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^狼女孩/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^经典/ })).toBeNull();
  });
});

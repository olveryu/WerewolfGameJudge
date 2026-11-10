/** Player profile card: the unlock count opens that player's collection in the same room. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

import type { UserPublicProfile } from '@/features/account/services/accountApi';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';

import { PlayerProfileCard } from '../PlayerProfileCard';

const PROFILE: UserPublicProfile = {
  displayName: '狼王 & 好人',
  level: 3,
  title: '新手',
  xp: 40,
  gamesPlayed: 9,
  unlockedItemCount: 12,
};

vi.mock('@/features/account/queries/useUserProfileQuery', () => ({
  useUserProfileQuery: () => ({ data: PROFILE, isLoading: false, isError: false }),
}));
vi.mock('@/features/account/services/accountApi', () => ({
  fetchUserUnlocks: vi.fn(() => new Promise(() => {})),
}));

function CurrentLocation() {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
}

it('closes the card and opens the player unlocks with their name', async () => {
  const onClose = vi.fn();
  const model: RoomProfileCardModel = {
    target: { seat: 2, occupant: { kind: 'human', userId: 'user-2' }, rosterName: '' },
    isSelf: false,
    onClose,
    onKick: null,
    onLeaveSeat: null,
    gameDetails: null,
  };
  const router = createMemoryRouter(
    [
      { path: '/room/:roomCode', element: <PlayerProfileCard model={model} roomCode="1234" /> },
      { path: '/unlocks/:roomCode', element: <CurrentLocation /> },
    ],
    { initialEntries: ['/room/1234'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await userEvent.click(screen.getByRole('button', { name: '已解锁 ›' }));

  expect(onClose).toHaveBeenCalledOnce();
  const search = new URLSearchParams({ userId: 'user-2', displayName: PROFILE.displayName });
  expect(await screen.findByText(`at /unlocks/1234?${search.toString()}`)).toBeInTheDocument();
});

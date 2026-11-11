/**
 * Player profile card: the unlock count opens that player's collection in the same room, and the
 * card shows the player's equipped cosmetics, with the frame and flair drawn on the avatar.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import type { UserPublicProfile } from '@/features/account/services/accountApi';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';

import { PlayerProfileCard } from '../PlayerProfileCard';

const PROFILE: UserPublicProfile = {
  displayName: '狼王 & 好人',
  avatarFrame: 'wolfFang',
  seatFlair: 'nightSanctum',
  nameStyle: 'goldenScript',
  seatAnimation: 'throneArrival',
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
vi.mock('@/features/product/loadClientProductUi', () => {
  const unused = () => {
    throw new Error('The profile has no avatar or reveal effect to resolve');
  };
  const productUi = Promise.resolve({
    getAvatarDisplayName: unused,
    getRevealEffectPresentation: unused,
  });
  return { loadClientProductUi: () => productUi };
});
// The scene stage needs a canvas; the previews' own tests cover it. The tile reports its residents.
vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
  ResidentAvatarTile: ({ residents }: { residents: ResidentDecorations | null }) => (
    <span
      data-testid="resident-tile"
      data-frame={residents?.frameId ?? 'none'}
      data-flair={residents?.flairId ?? 'none'}
      data-pet={residents?.petId ?? 'none'}
      data-entrance={residents?.entranceId ?? 'none'}
    />
  ),
}));

function CurrentLocation() {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
}

function renderCard(onClose: () => void) {
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
}

it('closes the card and opens the player unlocks with their name', async () => {
  const onClose = vi.fn();
  renderCard(onClose);

  await userEvent.click(screen.getByRole('button', { name: '已解锁 ›' }));

  expect(onClose).toHaveBeenCalledOnce();
  const search = new URLSearchParams({ userId: 'user-2', displayName: PROFILE.displayName });
  expect(await screen.findByText(`at /unlocks/1234?${search.toString()}`)).toBeInTheDocument();
});

it('draws the equipped frame and flair on the avatar, without the seat pet or entrance', () => {
  renderCard(vi.fn());

  const tile = screen.getByTestId('resident-tile');
  expect(tile).toHaveAttribute('data-frame', 'wolfFang');
  expect(tile).toHaveAttribute('data-flair', 'nightSanctum');
  expect(tile).toHaveAttribute('data-pet', 'none');
  expect(tile).toHaveAttribute('data-entrance', 'none');
});

it('shows each equipped cosmetic by name and marks empty slots', async () => {
  renderCard(vi.fn());

  const showcase = await screen.findByTestId(TESTIDS.playerProfileEquipment);
  for (const name of ['狼牙', '永夜圣域', '金缕天书', '王座降临']) {
    expect(within(showcase).getByText(name)).toBeInTheDocument();
  }
  expect(within(showcase).getByText('史诗')).toBeInTheDocument();
  expect(within(showcase).getAllByText('神话')).toHaveLength(3);
  expect(within(showcase).getAllByText('未装备')).toHaveLength(2);
});

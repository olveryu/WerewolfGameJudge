/**
 * The Avalon room renders the shared review: while the game runs there is
 * no entry; once it ended, a seat's bottom 本局复盘 entry and the host's
 * task card entry (its only one) open the platform dialog on the Avalon
 * document, and its close button dismisses it.
 * States come from the real engine; the session is a fake link.
 */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import { avalonTestSeatUser, playAvalonTestGame } from '@/test-utils/avalonState';
import { createFakeRoomLink, readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

import {
  avalonRoomScreenElement,
  AvalonRoomTestProviders,
} from './harness/avalonRoomScreenHarness';

const authUser = vi.hoisted(() => ({ id: '' }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: authUser.id, avatarUrl: null, equippedEffect: null },
    loading: false,
  }),
}));

vi.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

vi.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

vi.mock('@/features/room/services/recentRooms', () => ({
  addRecentRoom: vi.fn(),
}));

const ROOM: RoomRecord<'avalon'> = {
  roomCode: 'ABCD',
  roomId: 'room-abcd',
  gameType: 'avalon',
  hostUserId: avalonTestSeatUser(0),
  createdAt: new Date(0),
};

function renderRoom(state: AvalonState, viewerUserId: string) {
  authUser.id = viewerUserId;
  const session = createFakeRoomLink<AvalonState, AvalonPublicCommand>(
    readyLinkSnapshot({ room: ROOM, userId: viewerUserId }, createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  return render(avalonRoomScreenElement(ROOM, session), { wrapper: AvalonRoomTestProviders });
}

function expectAvalonReviewDialog() {
  const dialog = within(screen.getByTestId(TESTIDS.roomReviewDialog));
  expect(dialog.getByText('🏰 第 1 局 · 终局')).toBeTruthy();
  expect(dialog.getByText('坏人获胜')).toBeTruthy();
  expect(dialog.getByText('三个任务失败')).toBeTruthy();
  for (const title of ['全员身份', '本局配置', '任务进程']) {
    expect(dialog.getByText(title)).toBeTruthy();
  }
  expect(dialog.getByText('P3')).toBeTruthy();
  expect(dialog.queryByText('湖仙查验')).toBeNull();
}

describe('AvalonRoomScreen review', () => {
  it('offers no review while the game runs', () => {
    renderRoom(playAvalonTestGame(1), avalonTestSeatUser(0));
    expect(screen.queryByTestId(TESTIDS.roomReviewOpenButton)).toBeNull();
  });

  it('opens the shared dialog on the Avalon document from a seat bottom entry', () => {
    renderRoom(playAvalonTestGame(3), avalonTestSeatUser(1));
    fireEvent.click(screen.getByTestId(TESTIDS.roomReviewOpenButton));
    expectAvalonReviewDialog();

    fireEvent.click(screen.getByLabelText('关闭详情'));
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
  });

  it('gives the ended host exactly one review entry, on the host task card', () => {
    renderRoom(playAvalonTestGame(3), avalonTestSeatUser(0));
    expect(screen.getAllByRole('button', { name: '本局复盘' })).toHaveLength(1);
    expect(screen.queryByTestId(TESTIDS.roomReviewOpenButton)).toBeNull();
    fireEvent.click(screen.getByTestId(`${TESTIDS.roomHostTaskCard}-review`));
    expectAvalonReviewDialog();
  });
});

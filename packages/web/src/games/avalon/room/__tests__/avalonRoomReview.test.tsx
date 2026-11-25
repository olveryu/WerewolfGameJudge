/**
 * The Avalon room renders the shared review: while the game runs there is
 * no entry; once it ended, a seat's 本局复盘 entry and the host's
 * task entry in the shared actions panel open the platform dialog on Avalon
 * document, and its close button dismisses it.
 * States come from the real engine; the session is a fake link.
 */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import { avalonNightPhase, avalonTestSeatUser, playAvalonTestGame } from '@/test-utils/avalonState';
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
  it('keeps room information entries available during mandatory Assassin picking', () => {
    const finished = playAvalonTestGame(3);
    const assassin = Object.entries(finished.roles).find(([, role]) => role === 'assassin');
    if (assassin === undefined) throw new Error('Expected the dealt Assassin role');
    const assassinSeat = Number(assassin[0]);
    const state: AvalonState = {
      ...finished,
      phase: { kind: 'assassin', accusedSeat: null },
    };

    renderRoom(state, avalonTestSeatUser(assassinSeat));

    expect(screen.getByTestId(TESTIDS.avalonHistoryButton)).toBeVisible();
    fireEvent.click(screen.getByTestId(TESTIDS.roomManualButton));
    expect(screen.getByTestId(TESTIDS.roomGuideButton('avalon'))).toBeVisible();
  });

  it('offers no review while the game runs', () => {
    renderRoom(playAvalonTestGame(1), avalonTestSeatUser(0));
    expect(screen.queryByTestId(TESTIDS.roomReviewOpenButton)).toBeNull();
  });

  describe('AvalonRoomScreen host music toggle', () => {
    it('shows only for the host during the night', () => {
      const state = playAvalonTestGame(0);
      const nightState: AvalonState = {
        ...state,
        phase: avalonNightPhase('merlinReveal'),
      };
      renderRoom(nightState, avalonTestSeatUser(0));
      expect(screen.getByTestId(TESTIDS.bgmToggleButton)).toBeInTheDocument();
    });

    it('does not show for the host during the day or for a player at night', () => {
      renderRoom(playAvalonTestGame(0), avalonTestSeatUser(0));
      expect(screen.queryByTestId(TESTIDS.bgmToggleButton)).toBeNull();

      const state = playAvalonTestGame(0);
      renderRoom(
        {
          ...state,
          phase: avalonNightPhase('merlinReveal'),
        },
        avalonTestSeatUser(1),
      );
      expect(screen.queryByTestId(TESTIDS.bgmToggleButton)).toBeNull();
    });
  });

  it('opens the shared dialog on the Avalon document from a seat bottom entry', () => {
    renderRoom(playAvalonTestGame(3), avalonTestSeatUser(1));
    fireEvent.click(screen.getByTestId(TESTIDS.roomReviewOpenButton));
    expectAvalonReviewDialog();

    fireEvent.click(screen.getByLabelText('关闭详情'));
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
  });

  it('gives the ended host exactly one review entry, in the host task panel', () => {
    renderRoom(playAvalonTestGame(3), avalonTestSeatUser(0));
    fireEvent.click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
    expect(screen.getAllByRole('button', { name: '本局复盘' })).toHaveLength(1);
    expect(screen.queryByTestId(TESTIDS.roomReviewOpenButton)).toBeNull();
    fireEvent.click(screen.getByTestId(TESTIDS.roomReviewHostAction));
    expectAvalonReviewDialog();
  });
});

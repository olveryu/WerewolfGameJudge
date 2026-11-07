/**
 * The Avalon room renders the shared review: while the game runs there is
 * no entry; once it ended, the bottom 本局复盘 entry opens the platform
 * dialog on the Avalon document, and its close button dismisses it.
 * States come from the real engine; the session is a fake link.
 */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import { avalonTestSeatUser, playAvalonTestGame } from '@/test-utils/avalonState';
import { createFakeRoomLink, readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

import { avalonReview } from '../../review/avalonReview';
import { AvalonRoomScreen } from '../AvalonRoomScreen';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'host-1', avatarUrl: null, equippedEffect: null },
    loading: false,
  }),
}));

jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

jest.mock('@/features/product/hooks/useAppVisibility', () => ({
  useAppVisibility: () => true,
}));

jest.mock('@/features/room/services/recentRooms', () => ({
  addRecentRoom: jest.fn(),
}));

// The open dialog pre-captures its page in the background; nothing is captured here.
jest.mock('@/features/room/services/captureViewPngBase64', () => ({
  captureViewPngBase64: jest.fn(),
}));

const ROOM: RoomRecord<'avalon'> = {
  roomCode: 'ABCD',
  roomId: 'room-abcd',
  gameType: 'avalon',
  hostUserId: avalonTestSeatUser(0),
  createdAt: new Date(0),
};

function renderRoom(state: AvalonState) {
  const session = createFakeRoomLink<AvalonState, AvalonPublicCommand>(
    readyLinkSnapshot({ room: ROOM, userId: avalonTestSeatUser(0) }, createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  const props = {
    room: ROOM,
    entryReason: null,
    navigation: { navigate: jest.fn() },
    session,
    review: avalonReview,
    audio: {
      preload: jest.fn(async () => undefined),
      playEffect: jest.fn(async () => undefined),
      stopNarration: jest.fn(),
      stopBgm: jest.fn(),
    },
  } as unknown as ComponentProps<typeof AvalonRoomScreen>;
  return render(<AvalonRoomScreen {...props} />);
}

describe('AvalonRoomScreen review', () => {
  it('offers no review while the game runs', () => {
    renderRoom(playAvalonTestGame(1));
    expect(screen.queryByTestId(TESTIDS.roomReviewOpenButton)).toBeNull();
  });

  it('opens the shared dialog on the Avalon document from the ended bottom entry', () => {
    renderRoom(playAvalonTestGame(3));
    fireEvent.press(screen.getByTestId(TESTIDS.roomReviewOpenButton));

    const dialog = within(screen.getByTestId(TESTIDS.roomReviewDialog));
    expect(dialog.getByText('🏰 第 1 局 · 终局')).toBeTruthy();
    expect(dialog.getByText('坏人获胜')).toBeTruthy();
    expect(dialog.getByText('三个任务失败')).toBeTruthy();
    for (const title of ['全员身份', '本局配置', '任务进程']) {
      expect(dialog.getByText(title)).toBeTruthy();
    }
    expect(dialog.getByText('P3')).toBeTruthy();
    expect(dialog.queryByText('湖仙查验')).toBeNull();

    fireEvent.press(screen.getByLabelText('关闭详情'));
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
  });
});

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { useAuthContext } from '@/contexts/AuthContext';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { RoomSessionClient } from '@/features/room/session/types';

const mockUseAuthContext = jest.fn<ReturnType<typeof useAuthContext>, []>();
const mockUseRoomEntryController = jest.fn<RoomEntryController, [unknown]>();

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));
jest.mock('@/features/room/controllers/useRoomEntryController', () => ({
  useRoomEntryController: (params: unknown) => mockUseRoomEntryController(params),
}));
jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => false }));

const room = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf' as const,
  hostUserId: 'host-user',
  createdAt: new Date('2026-07-11T12:00:00.000Z'),
};

const session = {} as RoomSessionClient<
  {
    readonly gameType: 'werewolf';
    readonly stateVersion: 1;
    readonly roomCode: string;
    readonly hostUserId: string;
  },
  { readonly type: 'test' },
  { readonly eventId: string }
>;

function createController(isReady: boolean): RoomEntryController {
  return {
    isReady,
    isAuthRequired: false,
    loadingMessage: '正在加入房间',
    showRetryButton: false,
    connection: { status: isReady ? 'live' : 'connecting', onManualReconnect: jest.fn() },
    retry: jest.fn(),
    requestExit: jest.fn(),
  };
}

describe('RoomEntryBoundary', () => {
  beforeEach(() => {
    mockUseAuthContext.mockReturnValue({
      user: {
        id: 'host-user',
        email: null,
        displayName: null,
        avatarUrl: null,
        customAvatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        nameStyle: null,
        equippedEffect: null,
        seatAnimation: null,
        isAnonymous: false,
      },
      loading: false,
      error: null,
      isAuthenticated: true,
      needsWechatLogin: false,
      refreshUser: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      retryInit: jest.fn<void, []>(),
    });
    mockUseRoomEntryController.mockReturnValue(createController(false));
  });

  it('mounts game-owned children only after the session is ready', () => {
    const children = jest.fn(() => <Text testID="game-content">game</Text>);
    const ui = render(
      <RoomEntryBoundary room={room} session={session} onExit={jest.fn()}>
        {children}
      </RoomEntryBoundary>,
    );

    expect(children).not.toHaveBeenCalled();
    expect(ui.queryByTestId('game-content')).toBeNull();

    mockUseRoomEntryController.mockReturnValue(createController(true));
    ui.rerender(
      <RoomEntryBoundary room={room} session={session} onExit={jest.fn()}>
        {children}
      </RoomEntryBoundary>,
    );

    expect(children).toHaveBeenCalledTimes(1);
    expect(ui.getByTestId('game-content')).toBeTruthy();
  });
});

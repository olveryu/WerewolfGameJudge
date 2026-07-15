import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const mockRoom: React.ComponentProps<typeof WerewolfRoomScreen>['room'] = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: 'host-uid',
  createdAt: new Date(0),
};

// Schema-driven flow: when currentSchema is the step schema (witchPoison), seat tap triggers a confirm
// and confirmation submits a canonical Witch action input.
const mockSubmitAction = jest.fn();

// Witch poison phase: seat tap opens poison confirm and submits poisonTarget.
jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => {
  const { GameStatus } =
    require('@werewolf/game-engine/games/werewolf/public') as typeof import('@werewolf/game-engine/games/werewolf/public');
  return {
    useWerewolfRoom: () => {
      const gameState = {
        status: GameStatus.Ongoing,
        template: {
          numberOfPlayers: 12,
          roles: Array.from({ length: 12 }).map(() => 'villager'),
        },
        players: new Map(
          Array.from({ length: 12 }).map((_, i) => [
            i,
            {
              userId: `p${i}`,
              seat: i,
              displayName: `P${i + 1}`,
              avatarUrl: undefined,
              role: i === 0 ? 'witch' : 'villager',
              hasViewedRole: true,
            },
          ]),
        ),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        nightmareBlockedSeat: null,
        templateRoles: [],
        hostUserId: 'host',
        roomCode: '1234',
      };
      return {
        gameState,

        connectionStatus: 'live',

        isHost: false,
        roomStatus: (
          require('@werewolf/game-engine/games/werewolf/public') as typeof import('@werewolf/game-engine/games/werewolf/public')
        ).GameStatus.Ongoing,

        currentActionRole: 'witch',
        currentSchema: (() => {
          const { getSchema } =
            require('@werewolf/game-engine/games/werewolf/public') as typeof import('@werewolf/game-engine/games/werewolf/public');
          return getSchema('witchAction');
        })(),

        isAudioPlaying: false,

        mySeat: 0,
        myRole: 'witch',
        myUserId: 'p0',

        // Debug mode fields
        isDebugMode: false,
        controlledSeat: null,
        effectiveSeat: 0,
        effectiveRole: 'witch',
        fillWithBots: jest.fn(),
        markAllBotsViewed: jest.fn(),
        markAllBotsGroupConfirmed: jest.fn(),
        takeOverBot: jest.fn(),
        releaseBot: jest.fn(),

        takeSeat: jest.fn(),
        leaveSeat: jest.fn(),
        assignRoles: jest.fn(),
        startGame: jest.fn(),
        restartGame: jest.fn(),

        submitAction: mockSubmitAction,

        hasWolfVoted: () => false,
        viewedRole: jest.fn(),

        getLastNightInfo: jest.fn().mockReturnValue(''),

        submitRevealAck: jest.fn().mockResolvedValue({ success: true }),

        isBgmPlaying: false,
        playBgm: jest.fn(),
        stopBgm: jest.fn(),
      };
    },
  };
});

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showConfirmDialog: (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
    ) => {
      const { showAlert: localShowAlert } =
        require('@/utils/alert') as typeof import('@/utils/alert');
      localShowAlert(title, message, [
        { text: '取消', style: 'cancel', onPress: onCancel },
        { text: '确定', onPress: onConfirm },
      ]);
    },
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showWitchInfoPrompt: (
      _ctx: unknown,
      schema: { ui?: { prompt?: string } } | null,
      onDismiss: () => void,
    ) => {
      const { showAlert: localShowAlert } =
        require('@/utils/alert') as typeof import('@/utils/alert');
      localShowAlert('女巫信息', schema?.ui?.prompt || '', [
        { text: '知道了', onPress: onDismiss },
      ]);
    },
  }),
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

describe('WerewolfRoomScreen witch poison UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tap seat -> poison confirm -> submits canonical witch input', async () => {
    const { findByTestId } = render(
      <WerewolfRoomScreen
        navigation={
          mockNavigation as unknown as React.ComponentProps<typeof WerewolfRoomScreen>['navigation']
        }
        room={mockRoom}
        entryReason={null}
      />,
    );

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认行动', expect.any(String), expect.any(Array));
    });

    const poisonCall = jest.mocked(showAlert).mock.calls.find((c) => c[0] === '确认行动');
    expect(poisonCall).toBeDefined();

    const buttons = poisonCall![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith({
      kind: 'witch',
      saveTarget: null,
      poisonTarget: 2,
    });
  });

  // Regression guard: seat-tap poison must NOT be driven by any save-related context.
  // (phase field removed; seat taps always mean poison under new UX.)
  it('canSave=true still tap seat -> poison confirm -> submits poisonTarget', async () => {
    const { findByTestId } = render(
      <WerewolfRoomScreen
        navigation={
          mockNavigation as unknown as React.ComponentProps<typeof WerewolfRoomScreen>['navigation']
        }
        room={mockRoom}
        entryReason={null}
      />,
    );
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认行动', expect.any(String), expect.any(Array));
    });

    const confirmCall = jest.mocked(showAlert).mock.calls.find((c) => c[0] === '确认行动');
    expect(confirmCall).toBeDefined();

    const buttons = confirmCall![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith({
      kind: 'witch',
      saveTarget: null,
      poisonTarget: 2,
    });
  });
});

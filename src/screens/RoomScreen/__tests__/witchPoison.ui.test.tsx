import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({}));

// Use MockSafeAreaView from harness to preserve testID
jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('./harness');
  return { SafeAreaView: MockSafeAreaView };
});

// Schema-driven flow: when currentSchema is the step schema (witchPoison), seat tap triggers a confirm
// and confirmation submits submitAction(target, { poison: true }).
const mockSubmitAction = jest.fn();

// Witch poison phase: seat tap should open poison confirm -> confirm submits submitAction(target, {poison:true})
jest.mock('../../../hooks/useGameRoom', () => {
  const { GameStatus } = require('@werewolf/game-engine');
  return {
    useGameRoom: () => ({
      gameState: {
        status: GameStatus.Ongoing,
        template: {
          numberOfPlayers: 12,
          roles: Array.from({ length: 12 }).map(() => 'villager'),
        },
        players: new Map(
          Array.from({ length: 12 }).map((_, i) => [
            i,
            {
              uid: `p${i}`,
              seatNumber: i,
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
        hostUid: 'host',
        roomCode: '1234',
      },

      connectionStatus: 'live',

      isHost: false,
      roomStatus: require('@werewolf/game-engine/models/GameStatus').GameStatus.Ongoing,

      currentActionRole: 'witch',
      currentSchema: ((): any => {
        const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
        return getSchema('witchAction');
      })(),

      isAudioPlaying: false,

      mySeatNumber: 0,
      myRole: 'witch',
      myUid: 'p0',

      // Debug mode fields
      isDebugMode: false,
      controlledSeat: null,
      effectiveSeat: 0,
      effectiveRole: 'witch',
      fillWithBots: jest.fn(),
      markAllBotsViewed: jest.fn(),
      setControlledSeat: jest.fn(),

      joinRoom: jest.fn().mockResolvedValue(true),
      takeSeat: jest.fn(),
      leaveSeat: jest.fn(),
      assignRoles: jest.fn(),
      startGame: jest.fn(),
      restartGame: jest.fn(),

      submitAction: mockSubmitAction,
      submitWolfVote: jest.fn(),

      hasWolfVoted: () => false,
      requestSnapshot: jest.fn(),
      viewedRole: jest.fn(),

      lastSeatError: null,
      clearLastSeatError: jest.fn(),

      getLastNightInfo: jest.fn().mockReturnValue(''),

      submitRevealAck: jest.fn(),

      isBgmEnabled: true,
      toggleBgm: jest.fn(),
    }),
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
      const { showAlert: mockShowAlert } = require('@/utils/alert');
      mockShowAlert(title, message, [
        { text: '取消', style: 'cancel', onPress: onCancel },
        { text: '确定', onPress: onConfirm },
      ]);
    },
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showWitchInfoPrompt: (ctx: any, schema: any, onDismiss: () => void) => {
      const { showAlert: mockShowAlert } = require('@/utils/alert');
      mockShowAlert('女巫信息', schema?.ui?.prompt || '', [{ text: '知道了', onPress: onDismiss }]);
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

jest.mock('../useRoomSeatDialogs', () => ({
  useRoomSeatDialogs: () => ({
    showEnterSeatDialog: jest.fn(),
    showLeaveSeatDialog: jest.fn(),
    handleConfirmSeat: jest.fn(),
    handleCancelSeat: jest.fn(),
    handleConfirmLeave: jest.fn(),
    handleLeaveRoom: jest.fn(),
  }),
}));

describe('RoomScreen witch poison UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tap seat -> poison confirm -> submitAction(target, {poison:true})', async () => {
    const props: any = {
      navigation: mockNavigation,
      route: {
        params: {
          roomNumber: '1234',
          isHost: false,
          template: '梦魇守卫12人',
        },
      },
    };

    const { findByTestId } = render(<RoomScreen {...props} />);

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认行动', expect.any(String), expect.any(Array));
    });

    const poisonCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '确认行动');
    expect(poisonCall).toBeDefined();

    const buttons = (poisonCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    // protocol: seat = actorSeat (mySeatNumber=0), target in stepResults
    expect(mockSubmitAction).toHaveBeenCalledWith(0, { stepResults: { save: null, poison: 2 } });
  });

  // Regression guard: seat-tap poison must NOT be driven by any save-related context.
  // (phase field removed; seat taps always mean poison under new UX.)
  it('canSave=true still tap seat -> poison confirm -> submitAction(target, {poison:true})', async () => {
    const props: any = {
      navigation: mockNavigation,
      route: {
        params: {
          roomNumber: '1234',
          isHost: false,
          template: '梦魇守卫12人',
        },
      },
    };

    const { findByTestId } = render(<RoomScreen {...props} />);
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认行动', expect.any(String), expect.any(Array));
    });

    const confirmCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '确认行动');
    expect(confirmCall).toBeDefined();

    const buttons = (confirmCall as any)[2];
    const confirmBtn = (buttons as any[]).find((b: any) => b.text === '确定');
    await act(async () => {
      confirmBtn?.onPress?.();
    });

    // protocol: seat = actorSeat (mySeatNumber=0), target in stepResults
    expect(mockSubmitAction).toHaveBeenCalledWith(0, { stepResults: { save: null, poison: 2 } });
  });
});

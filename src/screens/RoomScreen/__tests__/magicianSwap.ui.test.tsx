import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

// Track showRoleActionPrompt calls to verify no duplicate actionPrompt triggers
const mockShowRoleActionPrompt = jest.fn();

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

const mockSubmitAction = jest.fn();

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => ({
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers: 12,
        roles: Array.from({ length: 12 }).map(() => 'villager'),
        actionOrder: ['magician'],
      },
      players: new Map(
        Array.from({ length: 12 }).map((_, i) => [
          i,
          {
            uid: `p${i}`,
            seatNumber: i,
            displayName: `P${i + 1}`,
            avatarUrl: undefined,
            role: i === 0 ? 'magician' : 'villager',
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
    roomStatus: require('@werewolf/game-engine/models/GameStatus').GameStatus.ongoing,

    currentActionRole: 'magician',
    currentSchema: (() => {
      const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
      return getSchema('magicianSwap');
    })(),

    isAudioPlaying: false,

    mySeatNumber: 0,
    myRole: 'magician',
    myUid: 'p0',

    // Debug mode fields
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: 0,
    effectiveRole: 'magician',
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
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

// Keep dialogs deterministic by mapping to showAlert
jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showMagicianFirstAlert: (seat: number, schema: any) => {
      const { showAlert: mockShowAlert } = require('@/utils/alert');
      const title = schema.ui.firstTargetTitle;
      const body = schema.ui.firstTargetPromptTemplate.replace('{seat}', `${seat + 1}`);
      mockShowAlert(title, body, [{ text: '好' }]);
    },
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
    showRoleActionPrompt: mockShowRoleActionPrompt,
  }),
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    showSpeakOrderDialog: jest.fn(),
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

describe('RoomScreen magician swap UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tap 1st seat -> tap 2nd seat -> confirm swap -> submitAction(null, { targets: [seatA, seatB] })', async () => {
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

    // first target: seat 3 (seat 2)
    const seat3 = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seat3);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '已选择第一位玩家',
        expect.stringContaining('3号'),
        expect.anything(),
      );
    });

    // second target: seat 5 (seat 4)
    const seat5 = await findByTestId(TESTIDS.seatTilePressable(4));
    fireEvent.press(seat5);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认交换', expect.any(String), expect.any(Array));
    });

    const confirmCall = (showAlert as jest.Mock).mock.calls.find(
      (c: unknown[]) => c[0] === '确认交换',
    );
    const buttons = confirmCall[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    // protocol: target = null, extra.targets = [seatA, seatB]
    // seat 3 (seat 2) and seat 5 (seat 4)
    expect(mockSubmitAction).toHaveBeenCalledWith(null, { targets: [2, 4] });

    // Regression check: actionPrompt should only trigger once at turn start,
    // NOT re-trigger when firstSwapSeat changes (after selecting first seat).
    // The initial prompt is shown once, and subsequent seat taps should not
    // cause additional actionPrompt dialogs.
    expect(mockShowRoleActionPrompt).toHaveBeenCalledTimes(1);
  });
});

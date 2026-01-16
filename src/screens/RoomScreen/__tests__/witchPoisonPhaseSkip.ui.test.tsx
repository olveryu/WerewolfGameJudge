import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { showAlert } from '../../../utils/alert';

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

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSubmitAction = jest.fn();

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => ({
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers: 12,
        roles: Array.from({ length: 12 }).map(() => 'villager'),
        actionOrder: ['witch'],
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
        ])
      ),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      nightmareBlockedSeat: null,
      templateRoles: [],
      hostUid: 'host',
      roomCode: '1234',
    },

    connectionStatus: 'live',

    isHost: false,
    roomStatus: require('../../../models/Room').RoomStatus.ongoing,

    currentActionRole: 'witch',
    currentSchema: ({ kind: 'compound', id: 'witch', displayName: '女巫' } as any),

    isAudioPlaying: false,

    mySeatNumber: 0,
    myRole: 'witch',

    createRoom: jest.fn(),
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

    waitForActionRejected: jest.fn().mockResolvedValue(null),

    // Provide witch context so save phase can show; we'll skip it.
    getWitchContext: jest.fn().mockReturnValue({ kind: 'WITCH_CONTEXT', killedIndex: 2, canSave: true }),
    getLastNightInfo: jest.fn().mockReturnValue(''),
    getLastNightDeaths: jest.fn().mockReturnValue([]),

    waitForSeerReveal: jest.fn(),
    waitForPsychicReveal: jest.fn(),
    waitForGargoyleReveal: jest.fn(),
    waitForWolfRobotReveal: jest.fn(),
    submitRevealAck: jest.fn(),
  }),
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

// NOTE: For witch compound schemas, skip intent is NOT schema-special.
// We keep this smoke test focused on bottom skip button wiring,
// so we force a generic skip intent to avoid coupling to schema-kind rules.
jest.mock('../hooks/useRoomActions', () => ({
  useRoomActions: () => ({
    getActionIntent: () => null,
    getSkipIntent: () => ({ type: 'skip', targetIndex: -1, message: '确定不发动技能吗？' }),
    getAutoTriggerIntent: () => ({ type: 'witchPoisonPhase', targetIndex: -1 }),
    getMagicianTarget: (n: number) => n,
  }),
}));

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showWitchSaveDialog: (killedIndex: number, canSave: boolean, _onSave: () => void, onSkip: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', [
        { text: '救助', onPress: jest.fn() },
        { text: '不救助', style: 'cancel', onPress: onSkip },
      ]);
    },
    showWitchPoisonPrompt: (onDismiss: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert('请选择是否使用毒药', '点击下方「不使用技能」可跳过', [{ text: '好', onPress: onDismiss }]);
    },
    showWitchPoisonConfirm: jest.fn(),
    showConfirmDialog: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    showWolfVoteDialog: jest.fn(),
    showStatusDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
  }),
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    showEmergencyRestartDialog: jest.fn(),
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

describe('RoomScreen witch poison phase skip UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('poison prompt -> shows hint about using bottom skip (smoke)', async () => {
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

  const { findByText } = render(<RoomScreen {...props} />);

  // Poison prompt should show (auto-trigger)
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '请选择是否使用毒药',
    expect.stringContaining('不使用技能'),
        expect.any(Array)
      );
    });

  // This is a compound schema phase; bottom skip is handled by a dialog flow.
  // We keep the smoke test lightweight and only verify the prompt wiring.
  await findByText('请选择使用毒药或解药');
  expect(mockSubmitAction).not.toHaveBeenCalled();
  });
});

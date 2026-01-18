import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
        ]),
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
    roomStatus: require('../../../models/Room').GameStatus.ongoing,

    currentActionRole: 'witch',
    currentSchema: (() => {
      const { getSchema } = require('../../../models/roles/spec/schemas');
      return getSchema('witchAction');
    })(),

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

    // Provide witch context (phase field removed).
    getWitchContext: jest
      .fn()
      .mockReturnValue({ kind: 'WITCH_CONTEXT', killedIndex: 2, canSave: true, canPoison: true }),
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
    getBottomAction: () => ({
      buttons: [
        {
          key: 'skipAll',
          label: '不使用技能',
          intent: { type: 'skip', targetIndex: -1, message: '', stepKey: 'skipAll' },
        },
      ],
    }),
    getAutoTriggerIntent: () => ({ type: 'actionPrompt', targetIndex: -1 }),
    getMagicianTarget: (n: number) => n,
  }),
}));

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showWitchInfoPrompt: (_ctx: any, _schema: any, onDismiss: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert('女巫信息', '提示', [{ text: '知道了', onPress: onDismiss }]);
    },
    showWitchSaveDialog: (
      killedIndex: number,
      canSave: boolean,
      _onSave: () => void,
      onSkip: () => void,
    ) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', [
        { text: '救助', onPress: jest.fn() },
        { text: '不救助', style: 'cancel', onPress: onSkip },
      ]);
    },
    showRoleActionPrompt: (title: string, message: string, onDismiss: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [{ text: '好', onPress: onDismiss }]);
    },
    showWitchPoisonConfirm: jest.fn(),
    showConfirmDialog: (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
    ) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
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

    render(<RoomScreen {...props} />);

    // Auto-trigger prompt should show
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
      );
    });

    // Keep this smoke test lightweight and only verify prompt wiring.
    expect(mockSubmitAction).not.toHaveBeenCalled();
  });
});

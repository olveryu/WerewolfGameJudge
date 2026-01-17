import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

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
    // Key: compound schema, not the step schema.
    currentSchema: ((): any => {
      const { getSchema } = require('../../../models/roles/spec/schemas');
      return getSchema('witchAction');
    })(),

    currentStepId: 'witchAction',
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
    viewedRole: jest.fn(),

    submitAction: mockSubmitAction,
    submitWolfVote: jest.fn(),
    hasWolfVoted: () => false,
    requestSnapshot: jest.fn(),

    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    waitForActionRejected: jest.fn().mockResolvedValue(null),

    // PR3: compound auto-trigger requires witch context (phase field removed).
    getWitchContext: jest.fn().mockReturnValue({ kind: 'WITCH_CONTEXT', killedIndex: 2, canSave: true, canPoison: true }),
    getLastNightInfo: jest.fn().mockReturnValue(''),

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

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showConfirmDialog: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showWitchSaveDialog: jest.fn(),
    showWitchPoisonPrompt: jest.fn(),
    showWitchPoisonConfirm: jest.fn(),
    showWitchInfoPrompt: (ctx: any, schema: any, onDismiss: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert('女巫信息', schema?.ui?.prompt || '', [{ text: '知道了', onPress: onDismiss }]);
    },
  }),
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
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

describe('RoomScreen witch compound UI (steps-driven)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto info prompt once -> dismiss -> shows two bottom buttons (save + skip)', async () => {
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

    // Auto-trigger info prompt should show once.
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('女巫信息', expect.any(String), expect.any(Array));
    });

    const promptCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '女巫信息');
    expect(promptCall).toBeDefined();
    const promptBtns = (promptCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const okBtn = promptBtns.find((b) => b.text === '知道了');
    await act(async () => {
      okBtn?.onPress?.();
    });

    // After dismiss, bottom buttons should be visible.
    await findByText('对3号用解药');
    await findByText('不使用技能');
  });
});

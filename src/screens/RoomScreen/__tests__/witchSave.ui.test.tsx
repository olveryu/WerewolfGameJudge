import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
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
    currentSchema: ((): any => {
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

    // Auto-trigger witchSavePhase requires witch context
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

// Do NOT mock useRoomActions: we want to cover auto-trigger -> RoomScreen -> dialogs wiring.

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showConfirmDialog: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel', onPress: onCancel },
      ]);
    },
    showWitchPoisonPrompt: jest.fn(),
    showWitchPoisonConfirm: jest.fn(),
    showWitchSaveDialog: jest.fn(),
    showWolfVoteDialog: jest.fn(),
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

describe('RoomScreen witch save UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-trigger prompt -> 点击底部跳过 -> submitAction(null,{save:false})', async () => {
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

    // Tap bottom skip button
  const skipBtn = await findByText('不使用技能');
    await act(async () => {
      fireEvent.press(skipBtn);
    });

    // Confirm skip dialog
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '确认跳过',
        expect.any(String),
        expect.any(Array)
      );
    });

    const confirmCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '确认跳过');
    expect(confirmCall).toBeDefined();
    const buttons = (confirmCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith(null, { save: false });
  });
});

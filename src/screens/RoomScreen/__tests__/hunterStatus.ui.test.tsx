import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { showAlert } from '../../../utils/alert';
import { TESTIDS } from '../../../testids';

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
        actionOrder: ['hunter'],
      },
      players: new Map(
        Array.from({ length: 12 }).map((_, i) => [
          i,
          {
            uid: `p${i}`,
            seatNumber: i,
            displayName: `P${i + 1}`,
            avatarUrl: undefined,
            role: i === 0 ? 'hunter' : 'villager',
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
  roomStatus: require('../../../models/Room').GameStatus.ongoing,

    currentActionRole: 'hunter',
    currentSchema: ((): any => {
      const { getSchema } = require('../../../models/roles/spec/schemas');
      return getSchema('hunterConfirm');
    })(),

    isAudioPlaying: false,

    mySeatNumber: 0,
    myRole: 'hunter',

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

    getWitchContext: jest.fn().mockReturnValue(null),
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

// Do NOT mock useRoomActions: cover auto-trigger confirm intent.

jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showConfirmDialog: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [
        { text: '取消', onPress: onCancel },
        { text: '确定', onPress: onConfirm },
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

describe('RoomScreen hunter status UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirm schema -> tap seat -> NO action (seat tap has no effect)', async () => {
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

    const screen = render(<RoomScreen {...props} />);

  // Wait for RoomScreen to finish initialization (leave loading screen)
  await screen.findByTestId(TESTIDS.roomScreenRoot);

    // Confirm schema: seat tap should have NO effect.
    // Action is triggered via bottom button only.
    const seatPressable = await screen.findByTestId(TESTIDS.seatTilePressable(0));
    await act(async () => {
  fireEvent.press(seatPressable);
    });

    // Verify NO confirmation dialog was shown (seat tap has no effect for confirm schema)
    await waitFor(() => {
      // showAlert should NOT have been called with '确认行动'
      const statusCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '确认行动');
      expect(statusCall).toBeFalsy();
    });

  // Verify submitAction was NOT called
  expect(mockSubmitAction).not.toHaveBeenCalled();
  });
});

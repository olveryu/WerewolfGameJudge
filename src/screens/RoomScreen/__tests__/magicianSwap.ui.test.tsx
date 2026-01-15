import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { TESTIDS } from '../../../testids';
import { showAlert } from '../../../utils/alert';
import type { SwapSchema } from '../../../models/roles/spec/schema.types';

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

    currentActionRole: 'magician',
    currentSchema: ({ kind: 'swap', id: 'magicianSwap', displayName: '魔术师交换' } as SwapSchema),

    isAudioPlaying: false,

    mySeatNumber: 0,
    myRole: 'magician',

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

// Keep dialogs deterministic by mapping to showAlert
jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showMagicianFirstAlert: (index: number) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`, [{ text: '好' }]);
    },
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

describe('RoomScreen magician swap UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tap 1st seat -> tap 2nd seat -> confirm swap -> submitAction(mergedTarget)', async () => {
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

    // first target: seat 3 (index 2)
    const seat3 = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seat3);
    });

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '已选择第一位玩家',
        expect.stringContaining('3号'),
        expect.anything()
      );
    });

    // second target: seat 5 (index 4)
    const seat5 = await findByTestId(TESTIDS.seatTilePressable(4));
    await act(async () => {
      fireEvent.press(seat5);
    });

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '确认交换',
        expect.any(String),
        expect.any(Array)
      );
    });

    const confirmCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '确认交换');
    const buttons = (confirmCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    // RoomScreen mergedTarget = anotherIndex + secondIndex*100 => 2 + 4*100 = 402
    expect(mockSubmitAction).toHaveBeenCalledWith(402, undefined);
  });
});

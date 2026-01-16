import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { TESTIDS } from '../../../testids';
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
const mockSubmitRevealAck = jest.fn();

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => ({
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers: 12,
        roles: Array.from({ length: 12 }).map(() => 'villager'),
        actionOrder: ['psychic'],
      },
      players: new Map(
        Array.from({ length: 12 }).map((_, i) => [
          i,
          {
            uid: `p${i}`,
            seatNumber: i,
            displayName: `P${i + 1}`,
            avatarUrl: undefined,
            role: i === 0 ? 'psychic' : 'villager',
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

    currentActionRole: 'psychic',
    currentSchema: ((): any => {
      const { getSchema } = require('../../../models/roles/spec/schemas');
      return getSchema('psychicCheck');
    })(),

    isAudioPlaying: false,

    mySeatNumber: 0,
    myRole: 'psychic',

    // Actions
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

    // Reveal plumbing
    waitForSeerReveal: jest.fn(),
    waitForPsychicReveal: jest.fn().mockResolvedValue({ kind: 'PSYCHIC_REVEAL', targetSeat: 2, result: '好人' }),
    waitForGargoyleReveal: jest.fn(),
    waitForWolfRobotReveal: jest.fn(),
    submitRevealAck: mockSubmitRevealAck,
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
    showRevealDialog: (title: string, message: string, onConfirm: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      mockShowAlert(title, message, [{ text: '好', onPress: onConfirm }]);
    },
    showWolfVoteDialog: jest.fn(),
    showStatusDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
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

describe('RoomScreen psychic reveal UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tap seat -> confirm check -> submitAction(target) -> show reveal -> ack', async () => {
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

    // Tap seat 3 (index 2)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    // Confirm check dialog (schema-driven)
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('确认通灵', expect.any(String), expect.any(Array));
    });

    const confirmCalls = (showAlert as jest.Mock).mock.calls.filter((c) => c[0] === '确认通灵');
    const confirmButtons = confirmCalls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = confirmButtons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith(2, undefined);

    // Reveal dialog
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('3号是'), expect.any(String), expect.any(Array));
    });

    const revealCall = (showAlert as jest.Mock).mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('3号是')
    );
    expect(revealCall).toBeDefined();

    const revealButtons = (revealCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const okBtn = revealButtons.find((b) => b.text === '好');

    await act(async () => {
      okBtn?.onPress?.();
    });

    expect(mockSubmitRevealAck).toHaveBeenCalled();
  });
});

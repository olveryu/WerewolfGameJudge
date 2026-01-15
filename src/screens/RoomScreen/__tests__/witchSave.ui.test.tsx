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
    showWitchSaveDialog: (killedIndex: number, canSave: boolean, onSave: () => void, onSkip: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      // Mirror dialog layer behavior in a stable way for the test
      if (killedIndex === -1) {
        mockShowAlert('昨夜无人倒台', '', [{ text: '好', onPress: onSkip }]);
        return;
      }
      if (!canSave) {
        mockShowAlert(`昨夜倒台玩家为${killedIndex + 1}号（你自己）`, '女巫无法自救', [{ text: '好', onPress: onSkip }]);
        return;
      }
      mockShowAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', [
        { text: '救助', onPress: onSave },
        { text: '不救助', style: 'cancel', onPress: onSkip },
      ]);
    },
    showWitchPoisonPrompt: jest.fn(),
    showWitchPoisonConfirm: jest.fn(),
    showConfirmDialog: jest.fn(),
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

describe('RoomScreen witch save UI (smoke)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-trigger save dialog -> 点击救助 -> submitAction(killedIndex,{save:true})', async () => {
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

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '昨夜倒台玩家为3号',
        '是否救助?',
        expect.any(Array)
      );
    });

    const saveCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '昨夜倒台玩家为3号');
    expect(saveCall).toBeDefined();

    const buttons = (saveCall as any)[2] as Array<{ text: string; onPress?: () => void }>;
    const saveBtn = buttons.find((b) => b.text === '救助');

    await act(async () => {
      saveBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith(2, { save: true });
  });
});

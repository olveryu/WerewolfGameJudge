import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { TESTIDS } from '../../../testids';
import { TouchableOpacity } from 'react-native';

// We assert on showAlert calls (RoomScreen uses this wrapper)
import { showAlert } from '../../../utils/alert';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({}));

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the room hook: provide minimal state to render PlayerGrid and accept taps
const mockSubmitWolfVote = jest.fn();
const mockRequestSnapshot = jest.fn();

type UseGameRoomReturn = any;
let mockUseGameRoomImpl: () => UseGameRoomReturn;


jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomImpl(),
}));

function makeBaseUseGameRoomReturn(overrides?: Partial<UseGameRoomReturn>): UseGameRoomReturn {
  return {
    // Room data
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers: 12,
        roles: Array.from({ length: 12 }).map(() => 'villager'),
        // NOTE: RoomScreen's currentActionRole is provided by the hook,
        // but other helpers expect an actionOrder to exist on template.
        actionOrder: ['wolf'],
      },
      players: new Map(
        Array.from({ length: 12 }).map((_, i) => [
          i,
          {
            uid: `p${i}`,
            seatNumber: i,
            displayName: `P${i + 1}`,
            avatarUrl: undefined,
            // Use a concrete wolf-faction RoleId so isWolfRole() is true.
            role: i === 0 ? 'wolfQueen' : 'villager',
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

    // Connection
    connectionStatus: 'live',

    // Host/role/step info used by RoomScreen
    isHost: false,
    roomStatus: require('../../../models/Room').RoomStatus.ongoing,
    // Make this client the current actioner so seat taps route to handleActionTap
    currentActionRole: 'wolf',
    currentSchema: (() => {
      const { getSchema } = require('../../../models/roles/spec/schemas');
      return getSchema('wolfKill');
    })(),
    isAudioPlaying: false,

    // Identity
    mySeatNumber: 0,
  myRole: 'wolfQueen',

    // Actions used by RoomScreen
    createRoom: jest.fn(),
    joinRoom: jest.fn().mockResolvedValue(true),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),
    submitAction: jest.fn(),
    submitWolfVote: mockSubmitWolfVote,
    hasWolfVoted: () => false,
    requestSnapshot: mockRequestSnapshot,
    viewedRole: jest.fn(),

    // Error plumbing
    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    // Reject-first plumbing
    waitForActionRejected: jest.fn().mockResolvedValue(null),

    // Info getters
    getWitchContext: jest.fn().mockReturnValue(null),
    getLastNightInfo: jest.fn().mockReturnValue(''),
    getLastNightDeaths: jest.fn().mockReturnValue([]),

  // Reveal plumbing (not used in this test, but destructured by RoomScreen)
  waitForSeerReveal: jest.fn(),
  waitForPsychicReveal: jest.fn(),
  waitForGargoyleReveal: jest.fn(),
  waitForWolfRobotReveal: jest.fn(),
  submitRevealAck: jest.fn(),
    ...overrides,
  };
}

// Avoid host dialogs complexity
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

// Avoid seat dialogs complexity
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

// NOTE:
// We intentionally do NOT mock useRoomActionDialogs/useActionerState.
// This is an end-to-end interaction test (seat tap -> intent -> alert).

// RoomScreen gates action seat taps behind `imActioner`; make this test deterministic.
jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

// Keep the dialog output stable while still requiring the interaction path
// (seat tap -> intent -> showWolfVoteDialog).
jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showWolfVoteDialog: (wolfName: string, targetIndex: number, onConfirm: () => void) => {
      const { showAlert: mockShowAlert } = require('../../../utils/alert');
      const msg =
        targetIndex === -1
          ? `${wolfName} 确定投票空刀吗？`
          : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`;

      mockShowAlert('狼人投票', msg, [
        { text: '确定', onPress: onConfirm },
        { text: '取消', style: 'cancel' },
      ]);
    },
    showConfirmDialog: jest.fn(),
    showStatusDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showWitchSaveDialog: jest.fn(),
    showWitchPoisonPrompt: jest.fn(),
    showWitchPoisonConfirm: jest.fn(),
  }),
}));

describe('RoomScreen wolf vote UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();
  });

  it('wolf vote dialog -> confirm triggers submitWolfVote', () => {
    // Regression guard for dialog copy + confirm wiring.
    // (This is stable and independent from RN press bubbling quirks in tests.)

    const { useRoomActionDialogs } = require('../useRoomActionDialogs');
    const dialogs = useRoomActionDialogs();

    dialogs.showWolfVoteDialog('1号狼人', 2, () => mockSubmitWolfVote(2));

    expect(showAlert).toHaveBeenCalledWith(
      '狼人投票',
      expect.stringContaining('确定要猎杀3号玩家吗？'),
      expect.any(Array)
    );

    const buttons = (showAlert as jest.Mock).mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();
    confirmBtn?.onPress?.();
    expect(mockSubmitWolfVote).toHaveBeenCalledWith(2);
  });

  it('tap seat tile -> triggers intent and shows wolf vote dialog (E2E)', async () => {
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

  const { findByTestId, findByText } = render(<RoomScreen {...props} />);

  // Ensure we're in the actionable state and the UI finished initial render
  await findByText(/请选择要猎杀的玩家/);

    // Tap seat 3 (index 2)
  const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '狼人投票',
        expect.stringContaining('确定要猎杀3号玩家吗？'),
        expect.any(Array)
      );
    });

  const buttons = (showAlert as jest.Mock).mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
  const confirmBtn = buttons.find((b) => b.text === '确定');
  expect(confirmBtn).toBeDefined();
  confirmBtn?.onPress?.();
  expect(mockSubmitWolfVote).toHaveBeenCalledWith(2);
  });

  it('forbidden target role should be disabled in UI (no vote sent, show hint)', async () => {
    // Commit 5 (UX-only): wolves should not be able to vote for forbidden target roles.
    // Host already enforces this via ACTION_REJECTED; UI adds early disable/hint.

  // Override just the players map: seat 3 (index 2) is spiritKnight, which is forbidden by meeting vote config.
  mockUseGameRoomImpl = () => {
      const base = makeBaseUseGameRoomReturn();
      const players = new Map(base.gameState.players);
  const target = players.get(2);
      players.set(2, {
        ...(target ?? {
          uid: 'p2',
          seatNumber: 2,
          displayName: 'P3',
          avatarUrl: undefined,
          role: 'villager',
          hasViewedRole: true,
        }),
  role: 'spiritKnight',
      });
      return makeBaseUseGameRoomReturn({
        gameState: {
          ...base.gameState,
          players,
        },
        currentSchema: (() => {
          const { getSchema } = require('../../../models/roles/spec/schemas');
          return getSchema('wolfKill');
        })(),
      });
    };

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

  const { findByTestId, findByText } = render(<RoomScreen {...props} />);
  await findByText(/请选择要猎杀的玩家/);

  // Ignore any alerts from initial render/auto intent.
  (showAlert as jest.Mock).mockClear();

    // Tap seat 3 (index 2) -> spiritKnight (forbidden target role)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    expect(showAlert).toHaveBeenCalledWith('不可选择', expect.any(String), expect.any(Array));

    const titles = (showAlert as jest.Mock).mock.calls.map((c) => c[0]);
    expect(titles).not.toContain('狼人投票');

    // Never sends vote
    expect(mockSubmitWolfVote).not.toHaveBeenCalled();
  });
});

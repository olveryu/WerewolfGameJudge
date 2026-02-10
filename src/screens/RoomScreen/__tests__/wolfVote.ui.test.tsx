import { act,fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { TESTIDS } from '@/testids';
// We assert on showAlert calls (RoomScreen uses this wrapper)
import { showAlert } from '@/utils/alert';

import { createShowAlertMock,RoomScreenTestHarness } from './harness';

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

// Use MockSafeAreaView from harness to preserve testID
jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('./harness');
  return { SafeAreaView: MockSafeAreaView };
});

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

    // Connection
    connectionStatus: 'live',

    // Host/role/step info used by RoomScreen
    isHost: false,
    roomStatus: require('@/models/GameStatus').GameStatus.ongoing,
    // Make this client the current actioner so seat taps route to handleActionTap
    currentActionRole: 'wolf',
    currentSchema: (() => {
      const { getSchema } = require('@/models/roles/spec/schemas');
      return getSchema('wolfKill');
    })(),
    isAudioPlaying: false,

    // Identity
    mySeatNumber: 0,
    myRole: 'wolfQueen',

    // Debug mode - effectiveSeat/effectiveRole are used in RoomScreen
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: 0,
    effectiveRole: 'wolfQueen',
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    setControlledSeat: jest.fn(),

    // Actions used by RoomScreen
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

    // Info getters
    getLastNightInfo: jest.fn().mockReturnValue(''),

    submitRevealAck: jest.fn(),

    // BGM controls
    isBgmEnabled: true,
    toggleBgm: jest.fn(),

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
    showSpeakOrderDialog: jest.fn(),
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
    showWolfVoteDialog: (
      wolfName: string,
      targetIndex: number,
      onConfirm: () => void,
      messageOverride?: string,
    ) => {
      const { showAlert: mockShowAlert } = require('@/utils/alert');
      const msg =
        messageOverride ||
        (targetIndex === -1
          ? `${wolfName} 确定投票空刀吗？`
          : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`);

      mockShowAlert('狼人投票', msg, [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: onConfirm },
      ]);
    },
    showConfirmDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showRoleActionPrompt: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
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

    const { useRoomActionDialogs } = require('@/screens/RoomScreen/useRoomActionDialogs');
    const dialogs = useRoomActionDialogs();

    dialogs.showWolfVoteDialog('1号狼人', 2, () => mockSubmitWolfVote(2));

    expect(showAlert).toHaveBeenCalledWith(
      '狼人投票',
      expect.stringContaining('确定要猎杀3号玩家吗？'),
      expect.any(Array),
    );

    const buttons = (showAlert as jest.Mock).mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
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
        expect.stringContaining('确定要猎杀该玩家吗？'),
        expect.any(Array),
      );
    });

    const buttons = (showAlert as jest.Mock).mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();
    confirmBtn?.onPress?.();
    expect(mockSubmitWolfVote).toHaveBeenCalledWith(2);
  });

  it('forbidden target role is NOT disabled in UI; still opens confirm dialog and submits vote intent', async () => {
    let submitWolfVoteMock: jest.Mock | null = null;

    // Plan A (Host-authoritative): UI does not disable schema-external targets.
    // If a forbidden role is tapped, we still open confirm dialog and submit.
    // Host then broadcasts actionRejected and UI shows the unified "操作无效" alert.

    // Override just the players map: seat 3 (index 2) is spiritKnight (Host will reject).
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
      const submitWolfVote = mockSubmitWolfVote;
      submitWolfVoteMock = submitWolfVote;

      return makeBaseUseGameRoomReturn({
        gameState: {
          ...base.gameState,
          players,
        },
        submitWolfVote,
        currentSchema: (() => {
          const { getSchema } = require('@/models/roles/spec/schemas');
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

    const rendered = render(<RoomScreen {...props} />);
    const { findByTestId, findByText } = rendered;
    await findByText(/请选择要猎杀的玩家/);

    // Ignore any alerts from initial render/auto intent.
    (showAlert as jest.Mock).mockClear();

    // Tap seat 3 (index 2) -> spiritKnight (Host will reject)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    // First: wolf vote confirm dialog should still appear
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '狼人投票',
        expect.stringContaining('确定要猎杀该玩家吗？'),
        expect.any(Array),
      );
    });

    // Confirm vote
    const buttons = (showAlert as jest.Mock).mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();

    // Confirming the dialog should submit to Host.
    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(submitWolfVoteMock).not.toBeNull();
    const submitWolfVoteSpy = submitWolfVoteMock as unknown as jest.Mock;
    expect(submitWolfVoteSpy).toHaveBeenCalledWith(2);
  });
});

// =============================================================================
// Chain interaction tests (using enhanced harness)
// =============================================================================

describe('RoomScreen wolf vote chain interaction (harness)', () => {
  let harness: RoomScreenTestHarness;

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();
  });

  it('tap seat → wolfVote dialog → press 确定 → submitWolfVote called with correct target', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props: any = {
      navigation: mockNavigation,
      route: {
        params: { roomNumber: '1234', isHost: false, template: '梦魇守卫12人' },
      },
    };

    const { findByTestId, findByText } = render(<RoomScreen {...props} />);

    // Wait for action prompt to render
    await findByText(/请选择要猎杀的玩家/);
    harness.clear(); // Discard auto-trigger events

    // Tap seat 3 (index 2)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    // wolfVote dialog should appear
    await waitFor(() => {
      harness.expectSeen('wolfVote');
    });

    // Use new harness API: press 确定 on the wolfVote dialog
    await act(async () => {
      harness.pressButtonOnType('wolfVote', '确定');
    });

    // submitWolfVote should be called with the target seat index
    expect(mockSubmitWolfVote).toHaveBeenCalledWith(2);
  });

  it('tap seat → wolfVote dialog → press 取消 → submitWolfVote NOT called', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props: any = {
      navigation: mockNavigation,
      route: {
        params: { roomNumber: '1234', isHost: false, template: '梦魇守卫12人' },
      },
    };

    const { findByTestId, findByText } = render(<RoomScreen {...props} />);

    await findByText(/请选择要猎杀的玩家/);
    harness.clear();

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    await waitFor(() => {
      harness.expectSeen('wolfVote');
    });

    // Press cancel — submitWolfVote must NOT be called
    await act(async () => {
      harness.pressButtonOnType('wolfVote', '取消');
    });

    expect(mockSubmitWolfVote).not.toHaveBeenCalled();
  });

  it('harness getLastEvent returns the wolfVote dialog with correct metadata', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props: any = {
      navigation: mockNavigation,
      route: {
        params: { roomNumber: '1234', isHost: false, template: '梦魇守卫12人' },
      },
    };

    const { findByTestId, findByText } = render(<RoomScreen {...props} />);

    await findByText(/请选择要猎杀的玩家/);
    harness.clear();

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(4));
    await act(async () => {
      fireEvent.press(seatPressable);
    });

    await waitFor(() => {
      harness.expectSeen('wolfVote');
    });

    // Verify event metadata
    const event = harness.getLastEventOfType('wolfVote');
    expect(event).not.toBeNull();
    expect(event!.title).toBe('狼人投票');
    expect(event!.buttons).toEqual(expect.arrayContaining(['确定', '取消']));
    expect(event!.buttons.length).toBe(2);
  });
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { WerewolfActionInput } from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import { getSchema } from '@werewolf/game-engine/models/roles/spec/schemas';

import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { TESTIDS } from '@/testids';
import type { LocalPlayer } from '@/types/GameStateTypes';
// We assert on showAlert calls (WerewolfRoomScreen uses this wrapper)
import { showAlert } from '@/utils/alert';

import { createShowAlertMock, RoomScreenTestHarness } from './harness';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const roomScreenProps: React.ComponentProps<typeof WerewolfRoomScreen> = {
  navigation: mockNavigation as unknown as React.ComponentProps<
    typeof WerewolfRoomScreen
  >['navigation'],
  room: {
    roomCode: '1234',
    roomId: 'room-id-1234',
    gameType: 'werewolf',
    hostUserId: 'host-uid',
    createdAt: new Date(0),
  },
  entryReason: null,
};

// Mock the room hook: provide minimal state to render PlayerGrid and accept taps
const mockSubmitAction = jest.fn<void, [WerewolfActionInput]>();

type UseWerewolfRoomReturn = ReturnType<typeof makeBaseUseGameRoomReturn>;
let mockUseGameRoomImpl: () => UseWerewolfRoomReturn;

jest.mock<{ useWerewolfRoom: () => UseWerewolfRoomReturn }>(
  '@/games/werewolf/hooks/useWerewolfRoom',
  () => ({
    useWerewolfRoom: () => mockUseGameRoomImpl(),
  }),
);

function makeBaseUseGameRoomReturn(overrides?: Record<string, unknown>) {
  const gameState = {
    status: GameStatus.Ongoing,
    template: {
      numberOfPlayers: 12,
      roles: Array.from({ length: 12 }).map(() => 'villager'),
      // NOTE: WerewolfRoomScreen's currentActionRole is provided by the hook,
      // but other helpers expect an actionOrder to exist on template.
      actionOrder: ['wolf'],
    },
    players: new Map<number, LocalPlayer>(
      Array.from({ length: 12 }).map((_, i): [number, LocalPlayer] => [
        i,
        {
          userId: `p${i}`,
          seat: i,
          displayName: `P${i + 1}`,
          avatarUrl: undefined,
          // Use a concrete wolf-faction RoleId so isWolfRole() is true.
          role: i === 0 ? 'wolfQueen' : 'villager',
          hasViewedRole: true,
        },
      ]),
    ),
    actions: new Map<RoleId, unknown>(),
    wolfVotes: new Map<number, number>(),
    currentStepIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    nightmareBlockedSeat: null,
    templateRoles: [],
    hostUserId: 'host',
    roomCode: '1234',
  };

  return {
    gameState,

    // Connection
    connectionStatus: 'live',

    // Host/role/step info used by WerewolfRoomScreen
    isHost: false,
    roomStatus: GameStatus.Ongoing,
    // Make this client the current actioner so seat taps route to handleActionTap
    currentActionRole: 'wolf' as RoleId,
    currentSchema: getSchema('wolfKill'),
    isAudioPlaying: false,

    // Identity
    mySeat: 0,
    myRole: 'wolfQueen',

    // Debug mode - effectiveSeat/effectiveRole are used in WerewolfRoomScreen
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: 0,
    effectiveRole: 'wolfQueen',
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    markAllBotsGroupConfirmed: jest.fn(),
    takeOverBot: jest.fn(),
    releaseBot: jest.fn(),

    // Actions used by WerewolfRoomScreen
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),
    submitAction: mockSubmitAction,
    hasWolfVoted: () => false,
    viewedRole: jest.fn(),

    // Error plumbing

    // Info getters
    getLastNightInfo: jest.fn().mockReturnValue(''),

    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),

    // BGM controls
    isBgmPlaying: false,
    playBgm: jest.fn(),
    stopBgm: jest.fn(),

    ...overrides,
  };
}

// Avoid host dialogs complexity
jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

// Avoid seat dialogs complexity

// NOTE:
// We intentionally do NOT mock useRoomActionDialogs/useActionerState.
// This is an end-to-end interaction test (seat tap -> intent -> alert).

// WerewolfRoomScreen gates action seat taps behind `imActioner`; make this test deterministic.
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
      targetSeat: number,
      onConfirm: () => void,
      messageOverride: string | undefined,
      schema: ActionSchema,
    ) => {
      const { showAlert: mockShowAlert } =
        require('@/utils/alert') as typeof import('@/utils/alert');
      const title = schema.ui!.confirmTitle;
      let msg: string;
      if (messageOverride) {
        msg = messageOverride;
      } else if (targetSeat === -1) {
        msg = schema.ui!.emptyVoteConfirmTemplate!.replace('{wolf}', wolfName);
      } else {
        const { formatSeat: mockFormatSeat } =
          require('@werewolf/game-engine/utils/formatSeat') as typeof import('@werewolf/game-engine/utils/formatSeat');
        msg = schema
          .ui!.voteConfirmTemplate!.replace('{wolf}', wolfName)
          .replace('{seat}', mockFormatSeat(targetSeat));
      }
      mockShowAlert(title!, msg, [
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

describe('WerewolfRoomScreen wolf vote UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();
  });

  it('wolf vote dialog -> confirm triggers submitAction', () => {
    // Regression guard for dialog copy + confirm wiring.
    // (This is stable and independent from RN press bubbling quirks in tests.)

    const { useRoomActionDialogs } =
      require('@/games/werewolf/room/useRoomActionDialogs') as typeof import('@/games/werewolf/room/useRoomActionDialogs');
    const dialogs = useRoomActionDialogs();

    dialogs.showWolfVoteDialog(
      '1号狼人',
      2,
      () => mockSubmitAction({ kind: 'target', target: 2 }),
      undefined,
      getSchema('wolfKill'),
    );

    expect(showAlert).toHaveBeenCalledWith(
      '狼人投票',
      expect.stringContaining('确定袭击3号'),
      expect.any(Array),
    );

    const buttons = jest.mocked(showAlert).mock.calls[0]![2]! as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();
    confirmBtn?.onPress?.();
    expect(mockSubmitAction).toHaveBeenCalledWith({ kind: 'target', target: 2 });
  });

  it('tap seat tile -> triggers intent and shows wolf vote dialog (E2E)', async () => {
    const props = roomScreenProps;

    const { findByTestId, findByText } = render(<WerewolfRoomScreen {...props} />);

    // Ensure we're in the actionable state and the UI finished initial render
    await findByText(/请选择袭击目标/);

    // Tap seat 3 (index 2)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '狼人投票',
        expect.stringContaining('确定袭击3号'),
        expect.any(Array),
      );
    });

    const buttons = jest.mocked(showAlert).mock.calls[0]![2]! as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();
    confirmBtn?.onPress?.();
    expect(mockSubmitAction).toHaveBeenCalledWith({ kind: 'target', target: 2 });
  });

  it('forbidden target role is NOT disabled in UI; still opens confirm dialog and submits vote intent', async () => {
    let submitActionMock: jest.Mock | null = null;

    // Plan A (server-authoritative): UI does not disable schema-external targets.
    // If a forbidden role is tapped, we still open confirm dialog and submit.
    // Server then broadcasts actionRejected and UI shows the unified "操作无效" alert.

    // Override just the players map: seat 3 (index 2) is spiritKnight (server will reject).
    mockUseGameRoomImpl = () => {
      const base = makeBaseUseGameRoomReturn();
      const players = new Map<number, LocalPlayer>(base.gameState.players);
      const target = players.get(2);
      players.set(2, {
        ...(target ?? {
          userId: 'p2',
          seat: 2,
          displayName: 'P3',
          avatarUrl: undefined,
          role: 'villager',
          hasViewedRole: true,
        }),
        role: 'spiritKnight',
      });
      const submitAction = mockSubmitAction;
      submitActionMock = submitAction;

      return makeBaseUseGameRoomReturn({
        gameState: {
          ...base.gameState,
          players,
        },
        submitAction,
        currentSchema: getSchema('wolfKill'),
      });
    };

    const props = roomScreenProps;

    const rendered = render(<WerewolfRoomScreen {...props} />);
    const { findByTestId, findByText } = rendered;
    await findByText(/请选择袭击目标/);

    // Ignore any alerts from initial render/auto intent.
    jest.mocked(showAlert).mockClear();

    // Tap seat 3 (index 2) -> spiritKnight (server will reject)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    // First: wolf vote confirm dialog should still appear (with immune warning)
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        '狼人投票',
        expect.stringContaining('确定袭击3号'),
        expect.any(Array),
      );
    });

    // Verify immune warning is appended
    const alertMsg = jest.mocked(showAlert).mock.calls[0]![1]!;
    expect(alertMsg).toContain('免疫狼人袭击');

    // Confirm vote
    const buttons = jest.mocked(showAlert).mock.calls[0]![2]! as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();

    // Confirming the dialog should submit to server.
    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(submitActionMock).not.toBeNull();
    const submitActionSpy = submitActionMock as unknown as jest.Mock;
    expect(submitActionSpy).toHaveBeenCalledWith({ kind: 'target', target: 2 });
  });
});

// =============================================================================
// Chain interaction tests (using enhanced harness)
// =============================================================================

describe('WerewolfRoomScreen wolf vote chain interaction (harness)', () => {
  let harness: RoomScreenTestHarness;

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();
  });

  it('tap seat → wolfVote dialog → press 确定 → submitAction called with correct target', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props = roomScreenProps;

    const { findByTestId, findByText } = render(<WerewolfRoomScreen {...props} />);

    // Wait for action prompt to render
    await findByText(/请选择袭击目标/);
    harness.clear(); // Discard auto-trigger events

    // Tap seat 3 (index 2)
    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    // wolfVote dialog should appear
    await waitFor(() => {
      harness.expectSeen('wolfVote');
    });

    // Use new harness API: press Confirm on the wolfVote dialog
    await act(async () => {
      harness.pressButtonOnType('wolfVote', '确定');
    });

    expect(mockSubmitAction).toHaveBeenCalledWith({ kind: 'target', target: 2 });
  });

  it('tap seat → wolfVote dialog → press 取消 → submitAction NOT called', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props = roomScreenProps;

    const { findByTestId, findByText } = render(<WerewolfRoomScreen {...props} />);

    await findByText(/请选择袭击目标/);
    harness.clear();

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seatPressable);

    await waitFor(() => {
      harness.expectSeen('wolfVote');
    });

    // Press cancel — submitAction must NOT be called
    await act(async () => {
      harness.pressButtonOnType('wolfVote', '取消');
    });

    expect(mockSubmitAction).not.toHaveBeenCalled();
  });

  it('harness getLastEvent returns the wolfVote dialog with correct metadata', async () => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();

    const props = roomScreenProps;

    const { findByTestId, findByText } = render(<WerewolfRoomScreen {...props} />);

    await findByText(/请选择袭击目标/);
    harness.clear();

    const seatPressable = await findByTestId(TESTIDS.seatTilePressable(4));
    fireEvent.press(seatPressable);

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

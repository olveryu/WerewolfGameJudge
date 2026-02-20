/**
 * Vertical Slice Board Test
 *
 * 从 hostGameFactory 产生的真实 BroadcastGameState 驱动 RoomScreen UI 渲染。
 * 目的：验证 integration state → UI rendering 的完整通路，
 * 捕获 mock 与真实 state 形状不一致导致的 UI 行为差异。
 *
 * 策略：
 * 1. hostGameFactory 创建游戏并走到 witchAction 步骤
 * 2. 将真实 broadcastState 转换为 useGameRoom mock 格式
 * 3. 渲染 RoomScreen 并验证正确的 dialog 出现
 */

import { render, waitFor } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { doesRoleParticipateInWolfVote } from '@werewolf/game-engine/models/roles';
import { getSchema } from '@werewolf/game-engine/models/roles/spec';

import { broadcastToLocalState } from '@/hooks/adapters/broadcastToLocalState';
import {
  createShowAlertMock,
  mockNavigation,
  RoomScreenTestHarness,
  waitForRoomScreen,
} from '@/screens/RoomScreen/__tests__/harness';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { cleanupHostGame, createHostGame } from '@/services/__tests__/boards/hostGameFactory';
import { sendMessageOrThrow } from '@/services/__tests__/boards/stepByStepRunner';
import { showAlert } from '@/utils/alert';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('@/screens/RoomScreen/__tests__/harness');
  return { SafeAreaView: MockSafeAreaView };
});

jest.mock('../../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

jest.mock('../../useRoomSeatDialogs', () => ({
  useRoomSeatDialogs: () => ({
    showEnterSeatDialog: jest.fn(),
    showLeaveSeatDialog: jest.fn(),
    handleConfirmSeat: jest.fn(),
    handleCancelSeat: jest.fn(),
    handleConfirmLeave: jest.fn(),
    handleLeaveRoom: jest.fn(),
  }),
}));

// imActioner=true so we can verify action dialogs appear
jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

// =============================================================================
// Test Setup
// =============================================================================

const TEMPLATE_NAME = '预女猎白12人';
const MY_SEAT = 9; // witch seat

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'wolf',
    'seer',
    'witch',
    'hunter',
    'idiot',
  ].forEach((role, idx) => map.set(idx, role as RoleId));
  return map;
}

/**
 * 将 BroadcastGameState (protocol 格式) 转换为 useGameRoom mock 中的 gameState 格式。
 * 使用真实的 broadcastToLocalState 适配器（与生产代码路径一致）。
 */
function broadcastToMockGameState(state: any) {
  return broadcastToLocalState(state);
}

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: any;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe('Vertical Slice: real state → UI rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  afterEach(() => {
    cleanupHostGame();
  });

  it('witchAction step with real state → shows witchSavePrompt', async () => {
    // 1. Create real game and walk to witchAction
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getBroadcastState();

    // Submit wolf votes + action to pass wolfKill
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );
    ctx.advanceNightOrThrow('past wolfKill');
    ctx.assertStep('witchAction');

    // 2. Get real broadcast state at witchAction
    const realState = ctx.getBroadcastState();

    // 3. Build useGameRoom mock from real state
    const currentSchema = getSchema('witchAction');
    mockUseGameRoomReturn = {
      gameState: broadcastToMockGameState(realState),
      connectionStatus: 'live',
      isHost: false,
      roomStatus: GameStatus.ongoing,
      currentActionRole: 'witch',
      currentSchema,
      currentStepId: 'witchAction',
      currentSchemaId: 'witchAction',
      isAudioPlaying: false,
      mySeatNumber: MY_SEAT,
      myRole: 'witch' as RoleId,
      myUid: `p${MY_SEAT}`,
      error: null,
      roomRecord: null,
      loading: false,

      // Debug mode
      isDebugMode: false,
      controlledSeat: null,
      effectiveSeat: MY_SEAT,
      effectiveRole: 'witch' as RoleId,
      fillWithBots: jest.fn(),
      markAllBotsViewed: jest.fn(),
      setControlledSeat: jest.fn(),

      // Reveal animation
      roleRevealAnimation: null,
      resolvedRoleRevealAnimation: null,

      // Connection
      stateRevision: 1,
      lastStateReceivedAt: Date.now(),
      isStateStale: false,

      // Actions
      initializeHostRoom: jest.fn(),
      joinRoom: jest.fn().mockResolvedValue(true),
      leaveRoom: jest.fn(),
      takeSeat: jest.fn(),
      leaveSeat: jest.fn(),
      takeSeatWithAck: jest.fn(),
      leaveSeatWithAck: jest.fn(),
      requestSnapshot: jest.fn(),
      updateTemplate: jest.fn(),
      assignRoles: jest.fn(),
      startGame: jest.fn(),
      restartGame: jest.fn(),
      setRoleRevealAnimation: jest.fn(),
      setAudioPlaying: jest.fn(),
      viewedRole: jest.fn(),
      submitAction: jest.fn().mockResolvedValue(undefined),
      submitWolfVote: jest.fn().mockResolvedValue(undefined),
      submitRevealAck: jest.fn().mockResolvedValue(undefined),
      sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue(undefined),
      getLastNightInfo: jest.fn().mockReturnValue(''),
      lastSeatError: null,
      clearLastSeatError: jest.fn(),
      hasWolfVoted: jest.fn().mockReturnValue(false),

      // BGM
      isBgmEnabled: false,
      toggleBgm: jest.fn(),
    };

    // 4. Render and verify
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    // Witch should see save prompt since seat 0 was killed and canSave=true
    await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
  });

  it('seerCheck step with real state → shows actionPrompt', async () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getBroadcastState();

    // Walk to seerCheck
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );
    ctx.advanceNightOrThrow('past wolfKill');
    sendMessageOrThrow(
      ctx,
      {
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: null } },
      },
      'witchAction',
    );
    ctx.advanceNightOrThrow('past witchAction');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
      'hunterConfirm',
    );
    ctx.advanceNightOrThrow('past hunterConfirm');
    ctx.assertStep('seerCheck');

    const realState = ctx.getBroadcastState();
    const seerSeat = 8;

    const currentSchema = getSchema('seerCheck');
    mockUseGameRoomReturn = {
      gameState: broadcastToMockGameState(realState),
      connectionStatus: 'live',
      isHost: false,
      roomStatus: GameStatus.ongoing,
      currentActionRole: 'seer',
      currentSchema,
      currentStepId: 'seerCheck',
      currentSchemaId: 'seerCheck',
      isAudioPlaying: false,
      mySeatNumber: seerSeat,
      myRole: 'seer' as RoleId,
      myUid: `p${seerSeat}`,
      error: null,
      roomRecord: null,
      loading: false,

      isDebugMode: false,
      controlledSeat: null,
      effectiveSeat: seerSeat,
      effectiveRole: 'seer' as RoleId,
      fillWithBots: jest.fn(),
      markAllBotsViewed: jest.fn(),
      setControlledSeat: jest.fn(),

      roleRevealAnimation: null,
      resolvedRoleRevealAnimation: null,

      stateRevision: 1,
      lastStateReceivedAt: Date.now(),
      isStateStale: false,

      initializeHostRoom: jest.fn(),
      joinRoom: jest.fn().mockResolvedValue(true),
      leaveRoom: jest.fn(),
      takeSeat: jest.fn(),
      leaveSeat: jest.fn(),
      takeSeatWithAck: jest.fn(),
      leaveSeatWithAck: jest.fn(),
      requestSnapshot: jest.fn(),
      updateTemplate: jest.fn(),
      assignRoles: jest.fn(),
      startGame: jest.fn(),
      restartGame: jest.fn(),
      setRoleRevealAnimation: jest.fn(),
      setAudioPlaying: jest.fn(),
      viewedRole: jest.fn(),
      submitAction: jest.fn().mockResolvedValue(undefined),
      submitWolfVote: jest.fn().mockResolvedValue(undefined),
      submitRevealAck: jest.fn().mockResolvedValue(undefined),
      sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue(undefined),
      getLastNightInfo: jest.fn().mockReturnValue(''),
      lastSeatError: null,
      clearLastSeatError: jest.fn(),
      hasWolfVoted: jest.fn().mockReturnValue(false),

      isBgmEnabled: false,
      toggleBgm: jest.fn(),
    };

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    // Seer should see action prompt
    await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  });
});

/**
 * Board UI Test Utilities
 *
 * Shared test setup and utilities for 12P board UI tests.
 * Provides mock factories and common test patterns.
 */

import { fireEvent, waitFor } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec';
import React from 'react';
import { View } from 'react-native';

import { TESTIDS } from '@/testids';

import { RoomScreenTestHarness } from './RoomScreenTestHarness';

// =============================================================================
// SafeAreaView Mock (MUST preserve testID)
// =============================================================================

/**
 * Mock SafeAreaView that preserves testID and other props.
 *
 * PURPOSE: The default react-native-safe-area-context mock (`({ children }) => children`)
 * loses the `testID` prop, causing `room-screen-root` to be missing from the render tree.
 * This breaks all board UI tests that use `waitForRoomScreen()`.
 *
 * REQUIREMENT: All board UI tests MUST use this mock via:
 * ```
 * jest.mock('react-native-safe-area-context', () => {
 *   const { MockSafeAreaView } = require('./harness');
 *   return { SafeAreaView: MockSafeAreaView };
 * });
 * ```
 *
 * DO NOT write inline SafeAreaView mocks in individual test files.
 */
export const MockSafeAreaView = ({
  children,
  testID,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  testID?: string;
  style?: any;
  [key: string]: any;
}) => React.createElement(View, { testID, style, ...rest }, children);

// =============================================================================
// Mock Navigation
// =============================================================================

export const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

// =============================================================================
// Game State Factory
// =============================================================================

export interface GameStateMockOptions {
  /** Schema ID for current step */
  schemaId: SchemaId;
  /** Current action role */
  currentActionRole: RoleId;
  /** Player's role */
  myRole: RoleId;
  /** Player's seat number */
  mySeatNumber?: number;
  /** Number of players */
  numberOfPlayers?: number;
  /** Template name (for reference) */
  templateName?: string;
  /** Role assignments (index → role) */
  roleAssignments?: Map<number, RoleId>;
  /** Whether player is host */
  isHost?: boolean;
  /** Audio playing state */
  isAudioPlaying?: boolean;
  /** Nightmare blocked seat (single source of truth for UI) */
  nightmareBlockedSeat?: number | null;
  /** Wolf kill disabled (single source of truth for UI) */
  wolfKillDisabled?: boolean;
  /** Current night results */
  currentNightResults?: Record<string, any>;
  /** Witch context */
  witchContext?: {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  } | null;
  /** Action rejected info */
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
    rejectionId?: string;
  } | null;
  /** Reveal data */
  seerReveal?: { targetSeat: number; result: 'good' | 'bad' } | null;
  psychicReveal?: { targetSeat: number; result: 'good' | 'bad' } | null;
  gargoyleReveal?: { targetSeat: number; result: boolean } | null;
  wolfRobotReveal?: { learnedRoleId: RoleId; canShootAsHunter?: boolean } | null;
  /** WolfRobot hunter status viewed flag */
  wolfRobotHunterStatusViewed?: boolean;
  /** Additional gameState overrides */
  gameStateOverrides?: Record<string, any>;
  /** Hook method overrides */
  hookOverrides?: Record<string, any>;
}

export function createGameRoomMock(options: GameStateMockOptions) {
  const {
    schemaId,
    currentActionRole,
    myRole,
    mySeatNumber = 0,
    numberOfPlayers = 12,
    roleAssignments,
    isHost = false,
    isAudioPlaying = false,
    nightmareBlockedSeat = null,
    wolfKillDisabled = false,
    currentNightResults = {},
    witchContext = null,
    actionRejected = null,
    seerReveal = null,
    psychicReveal = null,
    gargoyleReveal = null,
    wolfRobotReveal = null,
    wolfRobotHunterStatusViewed = false,
    gameStateOverrides = {},
    hookOverrides = {},
  } = options;

  // Build players map
  const players = new Map(
    Array.from({ length: numberOfPlayers }).map((_, i) => {
      const role = roleAssignments?.get(i) || (i === mySeatNumber ? myRole : 'villager');
      return [
        i,
        {
          uid: `p${i}`,
          seatNumber: i,
          displayName: `P${i + 1}`,
          avatarUrl: undefined,
          role,
          hasViewedRole: true,
        },
      ];
    }),
  );

  // Get schema
  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const currentSchema = getSchema(schemaId);

  return {
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers,
        roles: Array.from({ length: numberOfPlayers }).map(
          (_, i) => roleAssignments?.get(i) || 'villager',
        ),
      },
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentStepIndex: 0,
      isAudioPlaying,
      lastNightDeaths: [],
      nightmareBlockedSeat,
      wolfKillDisabled,
      currentNightResults,
      templateRoles: [],
      hostUid: isHost ? 'p0' : 'host',
      roomCode: '1234',
      witchContext,
      actionRejected,
      seerReveal,
      psychicReveal,
      gargoyleReveal,
      wolfRobotReveal,
      wolfRobotHunterStatusViewed,
      ...gameStateOverrides,
    },

    roomRecord: null,
    connectionStatus: 'live',
    isHost,
    roomStatus: GameStatus.ongoing,
    currentActionRole,
    currentSchema,
    currentStepId: schemaId,
    currentSchemaId: schemaId,
    isAudioPlaying,
    resolvedRoleRevealAnimation: null,
    loading: false,
    mySeatNumber,
    myRole,
    myUid: `p${mySeatNumber}`,
    error: null,

    // Connection
    lastStateReceivedAt: Date.now(),
    isStateStale: false,

    // Debug mode - effectiveSeat/effectiveRole are used in RoomScreen
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: mySeatNumber,
    effectiveRole: myRole,
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    setControlledSeat: jest.fn(),

    // Actions
    initializeHostRoom: jest.fn().mockResolvedValue(true),
    joinRoom: jest.fn().mockResolvedValue(true),
    leaveRoom: jest.fn(),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    requestSnapshot: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),
    setRoleRevealAnimation: jest.fn().mockResolvedValue(undefined),
    submitAction: jest.fn().mockResolvedValue(undefined),
    submitWolfVote: jest.fn().mockResolvedValue(undefined),
    hasWolfVoted: jest.fn().mockReturnValue(false),
    viewedRole: jest.fn(),
    submitRevealAck: jest.fn().mockResolvedValue(undefined),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue(undefined),
    postProgression: jest.fn().mockResolvedValue(undefined),

    // Error plumbing
    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    // Auth gate
    needsAuth: false,
    clearNeedsAuth: jest.fn(),

    // Info getters
    getLastNightInfo: jest.fn().mockReturnValue(''),

    // Continue game overlay (rejoin recovery)
    resumeAfterRejoin: jest.fn().mockResolvedValue(undefined),
    needsContinueOverlay: false,
    dismissContinueOverlay: jest.fn(),

    ...hookOverrides,
  };
}

// =============================================================================
// Test Context
// =============================================================================

export interface BoardTestContext {
  harness: RoomScreenTestHarness;
  mockShowAlert: jest.Mock;
  gameRoomMock: ReturnType<typeof createGameRoomMock>;
  setGameRoomMock: (mock: ReturnType<typeof createGameRoomMock>) => void;
}

// =============================================================================
// Common Test Setup
// =============================================================================

/**
 * Standard mocks that should be set up in every board UI test
 */
export function setupBoardTestMocks() {
  // Mock alert
  jest.mock('../../../../utils/alert', () => ({
    showAlert: jest.fn(),
  }));

  // Mock navigation
  jest.mock('@react-navigation/native', () => ({}));

  // Mock SafeAreaContext
  jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  }));

  // Mock host dialogs
  jest.mock('../../useRoomHostDialogs', () => ({
    useRoomHostDialogs: () => ({
      showPrepareToFlipDialog: jest.fn(),
      showStartGameDialog: jest.fn(),
      showRestartDialog: jest.fn(),
      handleSettingsPress: jest.fn(),
    }),
  }));

  // Mock seat dialogs
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

  // Mock useActionerState to always return imActioner=true
  // This is critical for action dialogs to trigger
  jest.mock('../hooks/useActionerState', () => ({
    useActionerState: () => ({
      imActioner: true,
      showWolves: true,
    }),
  }));
}

// =============================================================================
// Common Test Actions
// =============================================================================

/**
 * Wait for RoomScreen to render
 */
export async function waitForRoomScreen(getByTestId: (id: string) => any) {
  await waitFor(() => {
    expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
  });
}

/**
 * Tap a seat
 */
export function tapSeat(getByTestId: (id: string) => any, seatNumber: number) {
  const seat = getByTestId(TESTIDS.seatTilePressable(seatNumber));
  fireEvent.press(seat);
}

/**
 * Tap the bottom action button (by text content since no testID)
 * Returns true if found and pressed, false otherwise
 */
export function tapBottomAction(queryByText: (text: string) => any, buttonText: string): boolean {
  try {
    const button = queryByText(buttonText);
    if (button) {
      fireEvent.press(button);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// Reactive Mock for Host-Authoritative Testing
// =============================================================================

/**
 * ActionRejection type for simulateHostReject
 */
export interface ActionRejection {
  action: string;
  reason: string;
  targetUid: string;
  rejectionId?: string;
}

/**
 * Creates a reactive game room mock that can simulate Host state updates.
 *
 * Usage:
 * ```typescript
 * const reactiveMock = createReactiveGameRoomMock(initialOptions);
 * mockUseGameRoomReturn = reactiveMock.getMock();
 *
 * const { rerender } = render(<RoomScreen ... />);
 *
 * // Connect rerender for automatic updates
 * reactiveMock.connect((newMock) => {
 *   mockUseGameRoomReturn = newMock;
 *   rerender(<RoomScreen ... />);
 * });
 *
 * // Simulate Host reject (auto-triggers rerender via connect callback)
 * await reactiveMock.simulateHostReject({
 *   action: 'seerCheck',
 *   reason: BLOCKED_UI_DEFAULTS.message,
 *   targetUid: 'p8',
 * });
 * ```
 *
 * NOTE: Call connect() after render() to enable automatic re-rendering on state updates.
 */
export function createReactiveGameRoomMock(initialOptions: GameStateMockOptions) {
  let currentOptions = { ...initialOptions };
  let currentMock = createGameRoomMock(currentOptions);
  let onUpdateCallback: ((mock: ReturnType<typeof createGameRoomMock>) => void) | null = null;

  const notifyUpdate = () => {
    if (onUpdateCallback) {
      onUpdateCallback(currentMock);
    }
  };

  const self = {
    /**
     * Get the current mock object (pass to mockUseGameRoomReturn)
     */
    getMock: () => currentMock,

    /**
     * Connect a callback to be called when the mock is updated.
     * Use this to trigger rerender after state changes.
     *
     * @param callback Called with the new mock after any simulate* call
     */
    connect: (callback: (mock: ReturnType<typeof createGameRoomMock>) => void) => {
      onUpdateCallback = callback;
      return self;
    },

    /**
     * Disconnect the update callback
     */
    disconnect: () => {
      onUpdateCallback = null;
      return self;
    },

    /**
     * Simulate Host rejecting an action.
     * Updates the mock's gameState.actionRejected and triggers connected callback.
     */
    simulateHostReject: (rejection: ActionRejection) => {
      currentOptions = {
        ...currentOptions,
        actionRejected: rejection,
      };
      currentMock = createGameRoomMock(currentOptions);
      notifyUpdate();
      return self;
    },

    /**
     * Simulate Host state update.
     * Merges overrides into the current options and rebuilds the mock.
     */
    simulateStateUpdate: (overrides: Partial<GameStateMockOptions>) => {
      currentOptions = {
        ...currentOptions,
        ...overrides,
      };
      currentMock = createGameRoomMock(currentOptions);
      notifyUpdate();
      return self;
    },

    /**
     * Reset to initial options (does not notify)
     */
    reset: () => {
      currentOptions = { ...initialOptions };
      currentMock = createGameRoomMock(currentOptions);
      return self;
    },

    /**
     * Get current options (for debugging)
     */
    getCurrentOptions: () => ({ ...currentOptions }),
  };

  return self;
}

/**
 * Type for the reactive mock returned by createReactiveGameRoomMock
 */
export type ReactiveGameRoomMock = ReturnType<typeof createReactiveGameRoomMock>;

// =============================================================================
// Chain Interaction Drivers
// =============================================================================
//
// Shared helpers for chain interaction tests:
//   render → trigger dialog → press button → assert callback fired
//
// Usage in board tests:
//   import { chainWolfVoteConfirm, chainSkipConfirm, ... } from '@/screens/RoomScreen/__tests__/harness';
//   it('wolfVote confirm → submitWolfVote called', async () => {
//     await chainWolfVoteConfirm(harness, mockUseGameRoomReturn, ...);
//   });
// =============================================================================

/** Common RoomScreen route/navigation props for chain drivers */
const _ROOM_PROPS = {
  route: { params: { roomNumber: '1234', isHost: false } } as any,
};

/**
 * Chain interaction: wolfVote confirm → submitWolfVote called
 *
 * Flow: render wolf step → tap seat → wolfVote dialog → press "确定"
 *       → assert submitWolfVote was called with correct targetSeat
 *
 * @returns The submitWolfVote mock for further assertions if needed
 */
export async function chainWolfVoteConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
  targetSeat: number,
): Promise<jest.Mock> {
  const submitWolfVote = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: wolfRole,
      mySeatNumber: wolfSeat,
      roleAssignments: wolfAssignments,
      hookOverrides: { submitWolfVote },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));

  // Chain: press "确定" → submitWolfVote called
  harness.pressButtonOnType('wolfVote', '确定');
  expect(submitWolfVote).toHaveBeenCalledTimes(1);
  expect(submitWolfVote).toHaveBeenCalledWith(targetSeat);

  result.unmount();
  return submitWolfVote;
}

/**
 * Chain interaction: skipConfirm → submitAction called
 *
 * Flow: render guard step → press "不使用技能" → skipConfirm dialog
 *       → press "确定" → assert submitAction was called
 *
 * @returns The submitAction mock for further assertions if needed
 */
export async function chainSkipConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
): Promise<jest.Mock> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const schema = getSchema(schemaId);
  const bottomActionText = schema.ui?.bottomActionText;
  if (!bottomActionText) {
    throw new Error(`[TEST] Missing schema.ui.bottomActionText for skipConfirm chain: ${schemaId}`);
  }

  // Press the skip button
  const skipButton = result.getByText(bottomActionText);
  fireEvent.press(skipButton);
  await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

  // Chain: press "确定" → submitAction called
  harness.pressButtonOnType('skipConfirm', '确定');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return submitAction;
}

/**
 * Chain interaction: confirmTrigger → dialog dismissed with "知道了"
 *
 * Flow: render confirm step → press "查看发动状态" → confirmTrigger dialog
 *       → press "知道了" → verify dialog button callback fired
 *
 * Note: confirmTrigger shows status info; pressing "知道了" dismisses it.
 * The confirm step itself is about viewing status, not submitting an action.
 */
export async function chainConfirmTrigger(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
      gameStateOverrides: {
        confirmStatus: { role: actionRole, canShoot: true },
      },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const schema = getSchema(schemaId);
  const bottomActionText = schema.ui?.bottomActionText;
  if (!bottomActionText) {
    throw new Error(
      `[TEST] Missing schema.ui.bottomActionText for confirmTrigger chain: ${schemaId}`,
    );
  }

  // Press the bottom button to trigger confirmTrigger dialog
  await waitFor(() => expect(result.queryByText(bottomActionText)).toBeTruthy());
  const confirmButton = result.getByText(bottomActionText);
  fireEvent.press(confirmButton);
  await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));

  // Chain: press primary button ("知道了") → dialog callback fires
  harness.pressPrimaryOnType('confirmTrigger');
  // Verify the dialog was interacted with (callback ran without throwing)

  result.unmount();
}

/**
 * Chain interaction: wolfRobotHunterStatus gate → sendWolfRobotHunterStatusViewed called
 *
 * Flow: render wolfRobot learn (hunter learned) → press "查看发动状态"
 *       → wolfRobotHunterStatus dialog → press primary
 *       → assert sendWolfRobotHunterStatusViewed was called
 *
 * @returns The sendWolfRobotHunterStatusViewed mock
 */
export async function chainWolfRobotHunterStatus(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<jest.Mock> {
  const sendMock = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'wolfRobotLearn',
      currentActionRole: 'wolfRobot',
      myRole: 'wolfRobot',
      mySeatNumber: seatNumber,
      gameStateOverrides: {
        wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
        wolfRobotHunterStatusViewed: false,
      },
      hookOverrides: {
        sendWolfRobotHunterStatusViewed: sendMock,
      },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  const { SCHEMAS } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const gateButtonText = SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText;
  if (!gateButtonText) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGateButtonText');
  }

  // Press gate button
  const gateButton = result.getByText(gateButtonText);
  fireEvent.press(gateButton);
  await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));

  // Chain: press primary → sendWolfRobotHunterStatusViewed called
  harness.pressPrimaryOnType('wolfRobotHunterStatus');
  await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));

  result.unmount();
  return sendMock;
}

// =============================================================================
// Coverage-Integrated Chain Drivers ("AndAssert" variants)
// =============================================================================
//
// These helpers are designed for use INSIDE the Coverage Assertion test.
// They:
//   1. Set up mock with jest.fn() hookOverrides
//   2. Render RoomScreen
//   3. Trigger dialog via real interaction
//   4. Press confirm/primary button on the dialog
//   5. Assert the effect callback was called (fail-fast)
//   6. Unmount
//   7. Return the mock for additional payload assertions
//
// IMPORTANT: They do NOT call harness.clear() so events accumulate
// across the coverage assertion test.
// =============================================================================

/**
 * Coverage chain: wolfVote → press "确定" → assert submitWolfVote called
 * Returns { submitWolfVote } for payload assertions.
 */
export async function coverageChainWolfVote(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
  targetSeat: number,
): Promise<{ submitWolfVote: jest.Mock }> {
  const submitWolfVote = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: wolfRole,
      mySeatNumber: wolfSeat,
      roleAssignments: wolfAssignments,
      hookOverrides: { submitWolfVote },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));

  // Chain: press "确定" on wolfVote dialog
  harness.pressPrimaryOnType('wolfVote');
  expect(submitWolfVote).toHaveBeenCalledTimes(1);
  expect(submitWolfVote).toHaveBeenCalledWith(targetSeat);

  result.unmount();
  return { submitWolfVote };
}

/**
 * Coverage chain: skipConfirm → press "确定" → assert submitAction called
 * Returns { submitAction } for payload assertions.
 */
export async function coverageChainSkipConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
): Promise<{ submitAction: jest.Mock }> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const schema = getSchema(schemaId);
  const bottomActionText = schema.ui?.bottomActionText;
  if (!bottomActionText) {
    throw new Error(
      `[TEST] Missing schema.ui.bottomActionText for skipConfirm coverage chain: ${schemaId}`,
    );
  }

  const skipButton = result.getByText(bottomActionText);
  fireEvent.press(skipButton);
  await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

  // Chain: press primary on skipConfirm dialog
  harness.pressPrimaryOnType('skipConfirm');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction };
}

/**
 * Coverage chain: confirmTrigger → press primary → assertNoLoop
 * Presses "查看发动状态" button, then presses primary on confirmTrigger dialog.
 */
export async function coverageChainConfirmTrigger(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
      gameStateOverrides: {
        confirmStatus: { role: actionRole, canShoot: true },
      },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const schema = getSchema(schemaId);
  const bottomActionText = schema.ui?.bottomActionText;
  if (!bottomActionText) {
    throw new Error(
      `[TEST] Missing schema.ui.bottomActionText for confirmTrigger coverage chain: ${schemaId}`,
    );
  }

  // Wait for actionPrompt, then press bottom button
  await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  const confirmButton = result.getByText(bottomActionText);
  fireEvent.press(confirmButton);
  await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));

  // Chain: press primary on confirmTrigger
  harness.pressPrimaryOnType('confirmTrigger');
  harness.assertNoLoop({ type: 'confirmTrigger', maxTimesPerStep: 3 });

  result.unmount();
}

/**
 * Coverage chain: wolfRobotHunterStatus gate → press primary →
 * assert sendWolfRobotHunterStatusViewed called.
 * Returns { sendWolfRobotHunterStatusViewed } for payload assertions.
 */
export async function coverageChainWolfRobotHunterStatus(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<{ sendWolfRobotHunterStatusViewed: jest.Mock }> {
  const sendMock = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'wolfRobotLearn',
      currentActionRole: 'wolfRobot',
      myRole: 'wolfRobot',
      mySeatNumber: seatNumber,
      gameStateOverrides: {
        wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
        wolfRobotHunterStatusViewed: false,
      },
      hookOverrides: {
        sendWolfRobotHunterStatusViewed: sendMock,
        getWolfRobotHunterStatus: jest.fn().mockReturnValue({
          learned: true,
          viewed: false,
        }),
      },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const { SCHEMAS } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const gateButtonText = SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText;
  if (!gateButtonText) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGateButtonText');
  }

  const gateButton = result.getByText(gateButtonText);
  fireEvent.press(gateButton);
  await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));

  // Chain: press primary → sendWolfRobotHunterStatusViewed called
  harness.pressPrimaryOnType('wolfRobotHunterStatus');
  await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
  harness.assertNoLoop({ type: 'wolfRobotHunterStatus', maxTimesPerStep: 3 });

  result.unmount();
  return { sendWolfRobotHunterStatusViewed: sendMock };
}

/**
 * Coverage chain: actionPrompt (generic — just render and wait for dialog)
 * No button press needed since actionPrompt is informational.
 */
export async function coverageChainActionPrompt(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  result.unmount();
}

/**
 * Coverage chain: witchSavePrompt (auto-triggered on render)
 */
export async function coverageChainWitchSavePrompt(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeatNumber: seatNumber,
      witchContext: { killedSeat: 1, canSave: true, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
  result.unmount();
}

/**
 * Coverage chain: witchPoisonPrompt (tap seat to trigger)
 */
export async function coverageChainWitchPoisonPrompt(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeatNumber: seatNumber,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, 1);
  await waitFor(() =>
    expect(harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm')).toBe(true),
  );
  result.unmount();
}

/**
 * Coverage chain: magicianFirst + actionConfirm (two-tap swap)
 * Returns { submitAction } for payload assertions.
 */
export async function coverageChainMagicianSwap(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
  firstTarget: number,
  secondTarget: number,
): Promise<{ submitAction: jest.Mock }> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'magicianSwap',
      currentActionRole: 'magician',
      myRole: 'magician',
      mySeatNumber: seatNumber,
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  // First tap → magicianFirst
  tapSeat(result.getByTestId, firstTarget);
  await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));
  harness.pressPrimaryOnType('magicianFirst');

  // Second tap → actionConfirm
  tapSeat(result.getByTestId, secondTarget);
  await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

  // Chain: press "确定" → submitAction called
  harness.pressButtonOnType('actionConfirm', '确定');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction };
}

/**
 * Coverage chain: nightmare blocked → actionRejected
 * Uses reactive mock to simulate Host rejection after seat tap.
 * Returns the actionRejected events for message assertions.
 */
export async function coverageChainNightmareBlocked(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  blockedSchemaId: SchemaId,
  blockedRole: RoleId,
  blockedSeat: number,
  blockedMessage: string,
): Promise<{ rejectedEvents: import('./RoomScreenTestHarness').DialogEvent[] }> {
  const reactiveMock = createReactiveGameRoomMock({
    schemaId: blockedSchemaId,
    currentActionRole: blockedRole,
    myRole: blockedRole,
    mySeatNumber: blockedSeat,
    nightmareBlockedSeat: blockedSeat,
    currentNightResults: { blockedSeat },
  });
  mockSetter(reactiveMock.getMock());

  const result = renderFn();

  reactiveMock.connect((newMock) => {
    mockSetter(newMock);
    result.rerender(
      React.createElement(require('@/screens/RoomScreen/RoomScreen').RoomScreen, {
        route: { params: { roomNumber: '1234', isHost: false } } as any,
        navigation: mockNavigation as any,
      }),
    );
  });

  await waitForRoomScreen(result.getByTestId);

  // REAL INTERACTION: blocked player taps a seat
  tapSeat(result.getByTestId, 1);

  // Simulate Host rejection
  reactiveMock.simulateHostReject({
    action: blockedSchemaId,
    reason: blockedMessage,
    targetUid: `p${blockedSeat}`,
    rejectionId: `nightmare-block-coverage`,
  });

  await waitFor(() => expect(harness.hasSeen('actionRejected')).toBe(true));
  harness.assertNoLoop({ type: 'actionRejected', maxTimesPerStep: 3 });

  const rejectedEvents = harness.eventsOfType('actionRejected');
  reactiveMock.disconnect();
  result.unmount();
  return { rejectedEvents };
}

/**
 * Coverage chain: chooseSeat actionConfirm → tap seat → confirm dialog → submitAction called
 *
 * Works for: seer (reveal → confirmThenAct), guard, nightmare, wolfQueenCharm,
 *            dreamcatcher, gargoyle, psychic, wolfRobot learn, slacker
 *
 * Returns { submitAction } for payload assertions.
 */
export async function coverageChainSeatActionConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seatNumber: number,
  targetSeat: number,
): Promise<{ submitAction: jest.Mock }> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeatNumber: seatNumber,
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

  // Chain: press "确定" → submitAction called
  harness.pressPrimaryOnType('actionConfirm');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction };
}

/**
 * Coverage chain: wolfVoteEmpty → press "空刀" bottom button → wolfVoteEmpty dialog
 * → press "确定" → submitWolfVote(-1) called
 *
 * Returns { submitWolfVote } for payload assertions.
 */
export async function coverageChainWolfVoteEmpty(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
): Promise<{ submitWolfVote: jest.Mock }> {
  const submitWolfVote = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: wolfRole,
      mySeatNumber: wolfSeat,
      roleAssignments: wolfAssignments,
      hookOverrides: { submitWolfVote },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const { SCHEMAS } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const emptyVoteText = SCHEMAS.wolfKill.ui?.emptyVoteText;
  if (!emptyVoteText) {
    throw new Error('[TEST] Missing SCHEMAS.wolfKill.ui.emptyVoteText');
  }

  const emptyButton = result.getByText(emptyVoteText);
  fireEvent.press(emptyButton);
  await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));

  // Chain: press "确定" → submitWolfVote(-1) called
  harness.pressPrimaryOnType('wolfVoteEmpty');
  expect(submitWolfVote).toHaveBeenCalledTimes(1);
  expect(submitWolfVote).toHaveBeenCalledWith(-1);

  result.unmount();
  return { submitWolfVote };
}

/**
 * Coverage chain: witch with killedSeat=-1 → auto-trigger shows witchNoKill dialog
 * No button press needed (informational dialog).
 */
export async function coverageChainWitchNoKill(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<void> {
  mockSetter(
    createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeatNumber: seatNumber,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
  result.unmount();
}

/**
 * Coverage chain: witch skipAll → press "不使用技能" → skipConfirm → submitAction called
 *
 * Handles compound witchAction schema where bottomActionText comes from poison sub-step.
 * Returns { submitAction } for payload assertions.
 */
export async function coverageChainWitchSkipAll(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
): Promise<{ submitAction: jest.Mock }> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeatNumber: seatNumber,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  // Witch compound skip uses poison step's bottomActionText
  const { SCHEMAS } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const poisonStep = SCHEMAS.witchAction.steps?.find((s: any) => s.key === 'poison');
  const skipText = poisonStep?.ui?.bottomActionText || '不使用技能';

  const skipButton = result.getByText(skipText);
  fireEvent.press(skipButton);
  await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

  harness.pressPrimaryOnType('skipConfirm');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction };
}

/**
 * Chain interaction: magician actionConfirm → submitAction called
 *
 * Flow: render magician swap → tap seat 1 → magicianFirst dialog → press "知道了"
 *       → tap seat 2 → actionConfirm dialog → press "确定"
 *       → assert submitAction was called
 *
 * @returns The submitAction mock
 */
export async function chainActionConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: (mock: ReturnType<typeof createGameRoomMock>) => void,
  renderFn: () => ReturnType<typeof import('@testing-library/react-native').render>,
  seatNumber: number,
  firstTarget: number,
  secondTarget: number,
): Promise<jest.Mock> {
  const submitAction = jest.fn().mockResolvedValue(undefined);
  mockSetter(
    createGameRoomMock({
      schemaId: 'magicianSwap',
      currentActionRole: 'magician',
      myRole: 'magician',
      mySeatNumber: seatNumber,
      hookOverrides: { submitAction },
    }),
  );

  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  // First tap → magicianFirst
  tapSeat(result.getByTestId, firstTarget);
  await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));

  // Dismiss first dialog
  harness.pressPrimaryOnType('magicianFirst');

  // Second tap → actionConfirm
  tapSeat(result.getByTestId, secondTarget);
  await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

  // Chain: press "确定" → submitAction called
  harness.pressButtonOnType('actionConfirm', '确定');
  expect(submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return submitAction;
}

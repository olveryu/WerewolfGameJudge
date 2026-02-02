/**
 * Board UI Test Utilities
 *
 * Shared test setup and utilities for 12P board UI tests.
 * Provides mock factories and common test patterns.
 */

import React from 'react';
import { View } from 'react-native';
import { waitFor, fireEvent } from '@testing-library/react-native';
import type { RoleId } from '../../../../models/roles';
import type { SchemaId } from '../../../../models/roles/spec';
import { GameStatus } from '../../../../models/Room';
import { TESTIDS } from '../../../../testids';
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
  /** Nightmare blocked seat */
  nightmareBlockedSeat?: number | null;
  /** Current night results */
  currentNightResults?: Record<string, any>;
  /** Witch context */
  witchContext?: {
    killedIndex: number;
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
  const { getSchema } = require('../../../../models/roles/spec/schemas');
  const currentSchema = getSchema(schemaId);

  return {
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers,
        roles: Array.from({ length: numberOfPlayers }).map((_, i) =>
          roleAssignments?.get(i) || 'villager',
        ),
      },
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying,
      lastNightDeaths: [],
      nightmareBlockedSeat,
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

    connectionStatus: 'live',
    isHost,
    roomStatus: GameStatus.ongoing,
    currentActionRole,
    currentSchema,
    currentStepId: schemaId,
    isAudioPlaying,
    mySeatNumber,
    myRole,
    myUid: `p${mySeatNumber}`,
    error: null,

    // Actions
    createRoom: jest.fn(),
    joinRoom: jest.fn().mockResolvedValue(true),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),
    submitAction: jest.fn().mockResolvedValue(undefined),
    submitWolfVote: jest.fn().mockResolvedValue(undefined),
    hasWolfVoted: jest.fn().mockReturnValue(false),
    requestSnapshot: jest.fn(),
    viewedRole: jest.fn(),
    submitRevealAck: jest.fn().mockResolvedValue(undefined),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue(undefined),

    // Error plumbing
    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    // Info getters
    getLastNightInfo: jest.fn().mockReturnValue(''),
    getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),

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
      showLastNightInfoDialog: jest.fn(),
      showRestartDialog: jest.fn(),
      showSpeakOrderDialog: jest.fn(),
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

/**
 * Press a dialog button by text
 */
export function pressDialogButton(harness: RoomScreenTestHarness, text: string) {
  harness.press(text);
}

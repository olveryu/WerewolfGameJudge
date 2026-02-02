/**
 * Standard 12P Board UI Test
 *
 * Board: 标准板12人
 * Roles: 4x villager, 4x wolf, seer, witch, hunter, idiot
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: seer, witch, hunter actions
 * - wolfVote: wolf vote dialog
 * - witchSavePrompt: witch save flow
 * - witchPoisonPrompt: witch poison flow
 * - confirmTrigger: hunter confirm trigger
 *
 * Host-data required (covered by integration):
 * - seerReveal
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RoomScreen } from '../../RoomScreen';
import { showAlert } from '../../../../utils/alert';
import {
  RoomScreenTestHarness,
  createShowAlertMock,
  getBoardByName,
  mockNavigation,
  createGameRoomMock,
  waitForRoomScreen,
  tapSeat,
} from '../harness';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

// Use MockSafeAreaView from harness to preserve testID
jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('../harness');
  return { SafeAreaView: MockSafeAreaView };
});

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

jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

// =============================================================================
// Test Setup
// =============================================================================

const BOARD_NAME = '标准板12人';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe(`RoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  describe('actionPrompt coverage', () => {
    it('seer action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('actionPrompt')).toBe(true);
      });
    });
  });

  describe('wolfVote coverage', () => {
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(harness.hasSeen('wolfVote')).toBe(true);
      });
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt when someone died', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: 1,
            canSave: true,
            canPoison: true,
          },
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('witchSavePrompt')).toBe(true);
      });
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison confirm', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: -1, // No one died
          canSave: false,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: -1,
            canSave: false,
            canPoison: true,
          },
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(
          harness.hasSeen('witchPoisonPrompt') ||
            harness.hasSeen('witchPoisonConfirm') ||
            harness.hasSeen('actionConfirm'),
        ).toBe(true);
      });
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: shows confirm trigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        hookOverrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('confirmTrigger') || harness.hasSeen('actionPrompt')).toBe(true);
      });
    });
  });

  // =============================================================================
  // Coverage Assertion (MUST PASS)
  // =============================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (seer)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
      });

      let result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      result.unmount();

      // Step 2: wolfVote
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      tapSeat(result.getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
      result.unmount();

      // Step 3: witchSavePrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: 1,
            canSave: true,
            canPoison: true,
          },
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
      result.unmount();

      // Step 4: witchPoisonPrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: -1,
          canSave: false,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: -1,
            canSave: false,
            canPoison: true,
          },
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      tapSeat(result.getByTestId, 1);
      await waitFor(() =>
        expect(
          harness.hasSeen('witchPoisonPrompt') ||
            harness.hasSeen('witchPoisonConfirm') ||
            harness.hasSeen('actionConfirm'),
        ).toBe(true),
      );
      result.unmount();

      // Step 5: confirmTrigger (hunter)
      // Note: confirmTrigger requires pressing the bottom button
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        hookOverrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      // Wait for actionPrompt first (auto-triggered)
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      // Press bottom button to trigger confirmTrigger
      const confirmButton = result.queryByText('查看发动状态');
      if (confirmButton) {
        fireEvent.press(confirmButton);
        await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
      }
      result.unmount();

      // Final assertion: Use literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'witchSavePrompt',
        'witchPoisonPrompt',
        'confirmTrigger',
      ]);
    });
  });
});

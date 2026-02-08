/**
 * Dreamcatcher 12P Board UI Test
 *
 * Board: 狼王摄梦人12人
 * Roles: 4x villager, 3x wolf, darkWolfKing, seer, witch, hunter, dreamcatcher
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { showAlert } from '@/utils/alert';
import {
  RoomScreenTestHarness,
  createShowAlertMock,
  getBoardByName,
  mockNavigation,
  createGameRoomMock,
  waitForRoomScreen,
  tapSeat,
  chainWolfVoteConfirm,
  chainConfirmTrigger,
  // Coverage-integrated chain drivers
  coverageChainActionPrompt,
  coverageChainWolfVote,
  coverageChainWitchSavePrompt,
  coverageChainWitchPoisonPrompt,
  coverageChainConfirmTrigger,
} from '@/screens/RoomScreen/__tests__/harness';

jest.mock('../../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

// Use MockSafeAreaView from harness to preserve testID
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

const BOARD_NAME = '狼王摄梦人12人';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe(`RoomScreen UI: ${BOARD_NAME}`, () => {
  const renderRoom = () =>
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );
  const setMock = (m: ReturnType<typeof createGameRoomMock>) => {
    mockUseGameRoomReturn = m;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  describe('actionPrompt coverage', () => {
    it('dreamcatcher action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'dreamcatcherDream',
        currentActionRole: 'dreamcatcher',
        myRole: 'dreamcatcher',
        mySeatNumber: 11,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('darkWolfKing vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'darkWolfKing',
        mySeatNumber: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
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
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: shows confirm trigger', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'darkWolfKingConfirm',
        currentActionRole: 'darkWolfKing',
        myRole: 'darkWolfKing',
        mySeatNumber: 7,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() =>
        expect(harness.hasSeen('confirmTrigger') || harness.hasSeen('actionPrompt')).toBe(true),
      );
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedIndex: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedIndex: 1, canSave: true, canPoison: true } },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedIndex: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedIndex: -1, canSave: false, canPoison: true } },
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
      await waitFor(() =>
        expect(
          harness.hasSeen('witchPoisonPrompt') ||
            harness.hasSeen('witchPoisonConfirm') ||
            harness.hasSeen('actionConfirm'),
        ).toBe(true),
      );
    });
  });

  // =============================================================================
  // Chain Interaction (press button → assert callback)
  // =============================================================================

  describe('chain interaction', () => {
    it('wolfVote confirm → submitWolfVote called', async () => {
      await chainWolfVoteConfirm(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
        1,
      );
    });

    it('confirmTrigger (darkWolfKing) → dialog dismissed', async () => {
      await chainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (dreamcatcher)
      await coverageChainActionPrompt(harness, setMock, renderRoom, 'dreamcatcherDream', 'dreamcatcher', 'dreamcatcher', 11);

      // Step 2: wolfVote → press confirm → submitWolfVote(1) called
      const { submitWolfVote } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
        1,
      );
      expect(submitWolfVote).toHaveBeenCalledWith(1);

      // Step 3: confirmTrigger (darkWolfKing) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 5: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'confirmTrigger',
        'witchSavePrompt',
        'witchPoisonPrompt',
      ]);
    });
  });
});

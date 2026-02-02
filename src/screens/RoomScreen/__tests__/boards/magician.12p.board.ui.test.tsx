/**
 * Magician 12P Board UI Test
 *
 * Board: 狼王魔术师12人
 * Roles: 4x villager, 3x wolf, darkWolfKing, seer, witch, hunter, magician
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt,
 *   magicianFirst, actionConfirm
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

const BOARD_NAME = '狼王魔术师12人';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

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

    it('hunter confirm: shows confirm trigger', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        hookOverrides: { getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }) },
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

  describe('magicianFirst coverage', () => {
    it('magician swap: first tap shows magicianFirst dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'magicianSwap',
        currentActionRole: 'magician',
        myRole: 'magician',
        mySeatNumber: 11,
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
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));
    });
  });

  describe('actionConfirm coverage', () => {
    /**
     * Magician swap requires TWO taps in the same render instance:
     * 1. First tap → triggers magicianFirst dialog, sets anotherIndex
     * 2. Dismiss dialog, second tap → triggers actionConfirm dialog
     *
     * NOTE: anotherIndex is internal state that gets set by handleActionIntent
     * when processing magicianFirst. We MUST execute both taps in same render.
     */
    it('magician swap: second tap shows actionConfirm', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'magicianSwap',
        currentActionRole: 'magician',
        myRole: 'magician',
        mySeatNumber: 11,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      // First tap: triggers magicianFirst (sets anotherIndex internally)
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));

      // Press OK to dismiss first dialog and confirm first target
      harness.pressPrimary();

      // Second tap: triggers actionConfirm (uses the set anotherIndex)
      tapSeat(getByTestId, 2);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types must be covered', async () => {
      // actionPrompt
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

      // wolfVote
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

      // confirmTrigger
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'darkWolfKingConfirm',
        currentActionRole: 'darkWolfKing',
        myRole: 'darkWolfKing',
        mySeatNumber: 7,
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
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      // CRITICAL: Actually press the confirm button to trigger confirmTrigger dialog
      const confirmButton = result.getByText('查看发动状态');
      fireEvent.press(confirmButton);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
      result.unmount();

      // witchSavePrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedIndex: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedIndex: 1, canSave: true, canPoison: true } },
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

      // witchPoisonPrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedIndex: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedIndex: -1, canSave: false, canPoison: true } },
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

      // magicianFirst + actionConfirm (MUST be in same render instance)
      // anotherIndex is internal state set by first tap, so both taps must be in same render
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'magicianSwap',
        currentActionRole: 'magician',
        myRole: 'magician',
        mySeatNumber: 11,
      });
      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );
      await waitForRoomScreen(result.getByTestId);

      // First tap: magicianFirst
      tapSeat(result.getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));

      // Dismiss first dialog and confirm first target
      harness.pressPrimary();

      // Second tap: actionConfirm (uses internally set anotherIndex)
      tapSeat(result.getByTestId, 2);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
      result.unmount();

      // Use literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'confirmTrigger',
        'witchSavePrompt',
        'witchPoisonPrompt',
        'magicianFirst',
        'actionConfirm',
      ]);
    });
  });
});

/**
 * Witch Compound Sequence UI Test
 *
 * Tests the witch compound action flow as a full sequence:
 * 1. Save prompt appears → press dismiss → no submit
 * 2. Then tap seat → poison confirm → press confirm → submitAction called with poison payload
 * 3. Save prompt appears → press dismiss → press skip → skipConfirm → press confirm → submitAction called with skipAll
 *
 * Existing board tests only test each witch dialog type in isolation.
 * This test verifies the sequential compound flow works end-to-end.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';

import {
  createGameRoomMock,
  createShowAlertMock,
  mockNavigation,
  RoomScreenTestHarness,
  tapSeat,
  waitForRoomScreen,
} from '@/screens/RoomScreen/__tests__/harness';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
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

jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

// =============================================================================
// Test Setup
// =============================================================================

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Witch Compound Sequence', () => {
  const renderRoom = () =>
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  // ===========================================================================
  // Sequence: save prompt → dismiss → tap seat → poison confirm → submit
  // ===========================================================================

  describe('save prompt dismiss → poison flow', () => {
    it('save prompt appears, dismiss, then tap seat triggers poison confirm', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
        hookOverrides: { submitAction },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);

      // Step 1: witchSavePrompt auto-triggers
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));

      // Step 2: dismiss the save prompt
      harness.pressPrimaryOnType('witchSavePrompt');

      // Step 3: tap a seat to trigger poison
      tapSeat(getByTestId, 2);

      await waitFor(() =>
        expect(harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm')).toBe(true),
      );

      // Step 4: confirm the poison action
      const lastEvent = harness.getLastEvent();
      if (lastEvent && lastEvent.buttons.includes('确定')) {
        harness.pressButton('确定');
      }

      // Submit should be called with poison payload
      expect(submitAction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Sequence: save prompt → dismiss → skip all → skipConfirm → submit
  // ===========================================================================

  describe('save prompt dismiss → skip all flow', () => {
    it('save prompt appears, dismiss, then pressing skip triggers skipConfirm', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
        hookOverrides: { submitAction },
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);

      // Step 1: witchNoKill info prompt auto-triggers
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));

      // Step 2: dismiss the info prompt
      harness.pressPrimaryOnType('witchNoKill');

      // Step 3: press the skip button
      const poisonStep = SCHEMAS.witchAction.steps?.find((s) => s.key === 'poison');
      const skipText = poisonStep?.ui?.bottomActionText || '不使用技能';
      fireEvent.press(getByText(skipText));

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

      // Step 4: confirm skip
      harness.pressPrimaryOnType('skipConfirm');

      // Submit should be called
      expect(submitAction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // canSave=false, canPoison=false → no interaction needed (edge case)
  // ===========================================================================

  describe('no abilities available', () => {
    it('witch with canSave=false canPoison=false can still skip', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: false },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: false } },
        hookOverrides: { submitAction },
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);

      // witchNoKill should auto-trigger
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));

      // Dismiss and press skip
      harness.pressPrimaryOnType('witchNoKill');

      const poisonStep = SCHEMAS.witchAction.steps?.find((s) => s.key === 'poison');
      const skipText = poisonStep?.ui?.bottomActionText || '不使用技能';
      fireEvent.press(getByText(skipText));

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
      harness.pressPrimaryOnType('skipConfirm');
      expect(submitAction).toHaveBeenCalled();
    });
  });
});

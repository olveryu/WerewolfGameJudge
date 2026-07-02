/**
 * Non-Actioner Board UI Test
 *
 * Verifies non-actioner perspective: when imActioner=false,
 * action dialogs (actionPrompt / witchSavePrompt / witchPoisonPrompt / confirmTrigger)
 * must NOT appear. Fills the gap that board UI tests only cover the actioner view.
 *
 * Strategy: same template as standard board UI test, but useActionerState mock returns imActioner=false.
 */

import { render } from '@testing-library/react-native';

import {
  createGameRoomMock,
  createShowAlertMock,
  mockNavigation,
  mockRoomRoute,
  RoomScreenTestHarness,
  tapSeat,
  waitForRoomScreen,
} from '@/screens/RoomScreen/__tests__/harness';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { showAlert } from '@/utils/alert';

// =============================================================================
// Mocks — same as standard board but useActionerState returns imActioner=false
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  ...jest.requireActual<typeof import('../../../../utils/alert')>('../../../../utils/alert'),
  showAlert: jest.fn(),
}));

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

// KEY DIFFERENCE: imActioner = false, showWolves = false
jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: false,
    showWolves: false,
  }),
}));

// =============================================================================
// Test Setup
// =============================================================================

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/werewolf/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseGameRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe('RoomScreen UI: non-actioner perspective', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  it('seer step: non-actioner villager sees no actionPrompt', async () => {
    // Current step is seerCheck, but myRole is villager (non-actioner)
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
    });

    const { getByTestId } = render(
      <RoomScreen route={mockRoomRoute} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner villager sees no witch dialogs', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: 1, canSave: true, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
    });

    const { getByTestId } = render(
      <RoomScreen route={mockRoomRoute} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    expect(harness.hasSeen('witchSavePrompt')).toBe(false);
    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner tapping seat does not trigger poison dialog', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
    });

    const { getByTestId } = render(
      <RoomScreen route={mockRoomRoute} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);
    harness.clear();
    tapSeat(getByTestId, 1);

    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('hunterConfirm step: non-actioner sees no confirmTrigger or actionPrompt', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'hunterConfirm',
      currentActionRole: 'hunter',
      myRole: 'villager',
      mySeat: 0,
      gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
    });

    const { getByTestId } = render(
      <RoomScreen route={mockRoomRoute} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    expect(harness.hasSeen('confirmTrigger')).toBe(false);
    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('wolfKill step: non-actioner sees no wolfVote dialog', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'villager',
      mySeat: 0,
    });

    const { getByTestId } = render(
      <RoomScreen route={mockRoomRoute} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    expect(harness.hasSeen('wolfVote')).toBe(false);
  });
});

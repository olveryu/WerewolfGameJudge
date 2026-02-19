/**
 * Non-Actioner Board UI Test
 *
 * 验证非行动者视角：当 imActioner=false 时，
 * 行动类 dialog（actionPrompt / witchSavePrompt / witchPoisonPrompt / confirmTrigger）
 * 应该不出现。这补齐了 board UI 测试只测 actioner 视角的盲区。
 *
 * 策略：与 standard board UI test 同模板，但 useActionerState mock 返回 imActioner=false。
 */

import { act, render } from '@testing-library/react-native';

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
// Mocks — same as standard board but useActionerState returns imActioner=false
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

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe('RoomScreen UI: non-actioner perspective', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  it('seer step: non-actioner villager sees no actionPrompt', async () => {
    // 当前是 seerCheck 步骤，但 myRole 是 villager（非行动者）
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeatNumber: 0,
    });

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    // 等待一段时间确保如果 dialog 会弹出已经弹出
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner villager sees no witch dialogs', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeatNumber: 0,
      witchContext: { killedSeat: 1, canSave: true, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
    });

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(harness.hasSeen('witchSavePrompt')).toBe(false);
    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner tapping seat does not trigger poison dialog', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeatNumber: 0,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
      gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
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

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('hunterConfirm step: non-actioner sees no confirmTrigger or actionPrompt', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'hunterConfirm',
      currentActionRole: 'hunter',
      myRole: 'villager',
      mySeatNumber: 0,
      gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
    });

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(harness.hasSeen('confirmTrigger')).toBe(false);
    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('wolfKill step: non-actioner sees no wolfVote dialog', async () => {
    mockUseGameRoomReturn = createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'villager',
      mySeatNumber: 0,
    });

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitForRoomScreen(getByTestId);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(harness.hasSeen('wolfVote')).toBe(false);
  });
});

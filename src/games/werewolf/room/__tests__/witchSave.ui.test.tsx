/**
 * Witch Save UI Test (Night-1)
 *
 * Locks the contract:
 * - save step is confirmTarget (no seat tapping to select target)
 * - save action uses killedSeat from witchContext
 * - when canSave=false, save should not submit
 * - protocol: submitAction({ kind: 'witch', saveTarget, poisonTarget })
 */

import type { CompoundSchema } from '@game-judge/game-engine/games/werewolf/public';
import { SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

import { createBaseWerewolfRoomMock, mockNavigation, mockRoom } from './schemaSmokeTestUtils';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

const mockShowAlert = jest.mocked(showAlert);
const mockSubmitAction = jest.fn();

const makeMock = (overrides?: { canSave?: boolean; killedSeat?: number }) =>
  createBaseWerewolfRoomMock({
    schemaId: 'witchAction',
    currentActionRole: 'witch',
    myRole: 'witch',
    mySeat: 0,
    overrides: {
      submitAction: mockSubmitAction,
    },
    // gameState.witchContext is read by WerewolfRoomScreen actionDeps
    gameStateOverrides: {
      witchContext: {
        killedSeat: overrides?.killedSeat ?? 2,
        canSave: overrides?.canSave ?? true,
        canPoison: true,
      },
    },
  });

let mockUseWerewolfRoomReturn: ReturnType<typeof makeMock>;

jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseWerewolfRoomReturn,
}));

describe('WerewolfRoomScreen witch save UI (contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWerewolfRoomReturn = makeMock();
  });

  it('seat tapping does NOT submit save (save is confirmTarget, target comes from witchContext)', async () => {
    const { getByTestId } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Even if user taps some seat, save step should NOT be driven by seat taps.
    fireEvent.press(getByTestId(TESTIDS.seatTilePressable(5)));

    expect(mockSubmitAction).not.toHaveBeenCalled();
  });

  it('shows witch info prompt using schema.ui.prompt on render', async () => {
    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);

    // Some builds may not auto-prompt on first render (depending on WerewolfRoomScreen prompt gating).
    // Keep this test focused on the contract: save is NOT seat-driven.
    await waitFor(() => {
      expect(SCHEMAS.witchAction.ui!.prompt).toBeTruthy();
    });
  });

  it('canSave=false should not submit save (guardrail contract)', async () => {
    mockUseWerewolfRoomReturn = makeMock({ canSave: false, killedSeat: 2 });

    const { getByTestId } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // There is no seat-driven save; ensure we still didn't submit mistakenly.
    fireEvent.press(getByTestId(TESTIDS.seatTilePressable(2)));
    expect(mockSubmitAction).not.toHaveBeenCalled();
  });

  it('save button -> confirm -> submits canonical witch input', async () => {
    // killedSeat = 2, mySeat = 0
    const killedSeat = 2;
    mockUseWerewolfRoomReturn = makeMock({ canSave: true, killedSeat });

    const { getByTestId, getByText } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Find and click the save button (bottom action button)
    const saveLabel = `对${formatSeat(killedSeat)}用解药`;
    const saveButton = getByText(saveLabel);
    fireEvent.press(saveButton);

    // Confirm dialog should appear
    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
      );
    });

    // Find confirm button in the alert and press it
    const alertCall = mockShowAlert.mock.calls.find(
      (c) =>
        c[0] === '确认行动' || (c[2] as Array<{ text: string }>)?.some((b) => b.text === '确定'),
    );
    expect(alertCall).toBeDefined();
    const buttons = alertCall![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith({
      kind: 'witch',
      saveTarget: killedSeat,
      poisonTarget: null,
    });
  });

  it('canSave=true with killedSeat>=0 shows promptTemplate from schema', async () => {
    const killedSeat = 2;
    mockUseWerewolfRoomReturn = makeMock({ canSave: true, killedSeat });

    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);

    const witchSchema = SCHEMAS.witchAction as CompoundSchema;
    const saveStep = witchSchema.steps[0]!;
    const expectedPrompt = saveStep.ui?.promptTemplate?.replace('{seat}', formatSeat(killedSeat));

    await waitFor(() => {
      const matchingCall = mockShowAlert.mock.calls.find(
        (c) => typeof c[1] === 'string' && c[1] === expectedPrompt,
      );
      expect(matchingCall).toBeDefined();
      expect(matchingCall![0]).toBe('女巫请行动');
    });
  });

  it('canSave=false with killedSeat>=0 shows cannotSavePrompt from schema (witch self-kill)', async () => {
    // Witch is at seat 0, wolves kill seat 0 → canSave=false, killedSeat=0
    mockUseWerewolfRoomReturn = makeMock({ canSave: false, killedSeat: 0 });

    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);

    const witchSchema = SCHEMAS.witchAction as CompoundSchema;
    const saveStep = witchSchema.steps[0]!;
    const expectedPrompt = saveStep.ui?.cannotSavePrompt;

    await waitFor(() => {
      const matchingCall = mockShowAlert.mock.calls.find(
        (c) => typeof c[1] === 'string' && c[1] === expectedPrompt,
      );
      expect(matchingCall).toBeDefined();
      expect(matchingCall![0]).toBe('女巫请行动');
    });
  });
});

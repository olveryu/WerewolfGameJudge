import type {
  PresentedAction,
  StepPresentation,
  StepSubmission,
} from '@game-judge/game-engine/platform/steps';
import { STEP_RESULT_ACK_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { act, renderHook } from '@testing-library/react';

import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import { alertStore, dismissAlert } from '@/utils/alert';

import { useStepInteraction } from '../useStepInteraction';

const EMPTY_PRESENTATION: StepPresentation = {
  stepId: 'first',
  serial: 1,
  title: '行动',
  message: '请选择',
  actions: [],
  pendingResult: null,
  progress: null,
  deadlineMs: null,
};

function clearAlert(): void {
  const alert = alertStore.getSnapshot();
  if (alert !== null) dismissAlert(alert.generation);
}

async function pressButton(index: number): Promise<void> {
  const button = alertStore.getSnapshot()?.buttons[index];
  if (button === undefined) throw new Error(`Missing alert button ${index}`);
  await act(async () => button.onPress?.());
}

function pressRoomAction(action: RoomPlayerAction | undefined): void {
  if (action === undefined || action.state.kind !== 'ready') {
    throw new Error('Expected a ready room action');
  }
  const { onPress } = action.state;
  act(() => {
    onPress();
  });
}

function renderStepInteraction(
  action: PresentedAction,
  options: {
    readonly presentation?: StepPresentation;
    readonly isSuspended?: boolean;
    readonly hasPendingCommand?: boolean;
    readonly draftIdentity?: { readonly userId: string; readonly roomId: string };
  } = {},
) {
  const submit = vi.fn<(submission: StepSubmission) => Promise<boolean>>().mockResolvedValue(true);
  const describeConfirmation = vi.fn(() => ({
    title: '确认行动？',
    body: null,
    tone: 'default' as const,
  }));
  const base = options.presentation ?? EMPTY_PRESENTATION;
  const presentation = { ...base, actions: [action] };
  const hook = renderHook(
    ({ currentPresentation }: { readonly currentPresentation: StepPresentation }) =>
      useStepInteraction({
        presentation: currentPresentation,
        draftIdentity: options.draftIdentity ?? { userId: 'user-1', roomId: 'room-1' },
        describeConfirmation,
        submit,
        isSuspended: options.isSuspended ?? false,
        hasPendingCommand: options.hasPendingCommand ?? false,
      }),
    { initialProps: { currentPresentation: presentation } },
  );
  return { ...hook, submit, describeConfirmation, presentation };
}

beforeEach(() => {
  clearAlert();
  localStorage.clear();
});
afterEach(() => {
  clearAlert();
  localStorage.clear();
});

describe('useStepInteraction', () => {
  it('confirms a direct action before submitting it', async () => {
    const action: PresentedAction = {
      kind: 'direct',
      key: 'confirm',
      label: '执行',
      availability: { kind: 'available' },
    };
    const { result, submit } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    expect(alertStore.getSnapshot()?.title).toBe('确认行动？');
    await pressButton(1);

    expect(submit).toHaveBeenCalledWith({
      stepId: 'first',
      serial: 1,
      actionKey: 'confirm',
    });
  });

  it('auto-confirms a single selected seat and submits its draft', async () => {
    const action: PresentedAction = {
      kind: 'pickSeats',
      key: 'choose',
      label: '选择座位',
      availability: { kind: 'available' },
      min: 1,
      max: 1,
      seats: [
        { seat: 2, unavailableReason: null },
        { seat: 3, unavailableReason: '不可选' },
      ],
      committed: null,
    };
    const { result, submit } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    act(() => {
      result.current.onSeatTap(2);
    });

    expect(result.current.seatSelection?.selected).toEqual([2]);
    expect(alertStore.getSnapshot()?.title).toBe('确认行动？');
    await pressButton(1);
    expect(submit).toHaveBeenCalledWith({
      stepId: 'first',
      serial: 1,
      actionKey: 'choose',
      seats: [2],
    });
    expect(result.current.seatSelection).toBeNull();
  });

  it('clears a multi-seat draft when its confirmation is cancelled', async () => {
    const action: PresentedAction = {
      kind: 'pickSeats',
      key: 'chooseMany',
      label: '选择玩家',
      availability: { kind: 'available' },
      min: 1,
      max: 2,
      seats: [
        { seat: 0, unavailableReason: null },
        { seat: 1, unavailableReason: null },
      ],
      committed: null,
    };
    const { result } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    act(() => {
      result.current.onSeatTap(0);
    });
    pressRoomAction(result.current.actions[0]);

    expect(result.current.seatSelection?.selected).toEqual([0]);
    await pressButton(0);
    expect(result.current.seatSelection?.selected).toEqual([]);
  });

  it('restores a seat draft after remount for the same room, user and step', () => {
    const action: PresentedAction = {
      kind: 'pickSeats',
      key: 'choose',
      label: '选择玩家',
      availability: { kind: 'available' },
      min: 1,
      max: 2,
      seats: [
        { seat: 0, unavailableReason: null },
        { seat: 1, unavailableReason: null },
      ],
      committed: null,
    };
    const first = renderStepInteraction(action);
    pressRoomAction(first.result.current.actions[0]);
    act(() => {
      first.result.current.onSeatTap(0);
    });
    first.unmount();
    clearAlert();

    const second = renderStepInteraction(action);
    expect(second.result.current.seatSelection?.selected).toEqual([0]);
  });

  it('does not restore a seat draft for another user', () => {
    const action: PresentedAction = {
      kind: 'pickSeats',
      key: 'choose',
      label: '选择玩家',
      availability: { kind: 'available' },
      min: 1,
      max: 2,
      seats: [
        { seat: 0, unavailableReason: null },
        { seat: 1, unavailableReason: null },
      ],
      committed: null,
    };
    const first = renderStepInteraction(action);
    pressRoomAction(first.result.current.actions[0]);
    act(() => {
      first.result.current.onSeatTap(0);
    });
    first.unmount();
    clearAlert();

    const second = renderStepInteraction(action, {
      draftIdentity: { userId: 'user-2', roomId: 'room-1' },
    });
    pressRoomAction(second.result.current.actions[0]);
    expect(second.result.current.seatSelection?.selected).toEqual([]);
  });

  it('shows a private result automatically and acknowledges it on dismissal', async () => {
    const presentation: StepPresentation = {
      ...EMPTY_PRESENTATION,
      pendingResult: { title: '结果', text: '你看到了结果' },
    };
    const submit = vi
      .fn<(submission: StepSubmission) => Promise<boolean>>()
      .mockResolvedValue(true);
    renderHook(() =>
      useStepInteraction({
        presentation,
        draftIdentity: { userId: 'user-1', roomId: 'room-1' },
        describeConfirmation: () => ({ title: '', body: null, tone: 'default' }),
        submit,
        isSuspended: false,
        hasPendingCommand: false,
      }),
    );

    expect(alertStore.getSnapshot()?.title).toBe('结果');
    await pressButton(0);
    expect(submit).toHaveBeenCalledWith({
      stepId: 'first',
      serial: 1,
      actionKey: STEP_RESULT_ACK_ACTION_KEY,
    });
  });

  it('asks before showing view content and submits only after the result is acknowledged', async () => {
    const action: PresentedAction = {
      kind: 'view',
      key: 'view',
      label: '查看结果',
      availability: { kind: 'available' },
      content: { title: '秘密结果', text: '内容' },
      isAcknowledged: false,
    };
    const { result, submit } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    expect(alertStore.getSnapshot()?.title).toBe('查看结果？');
    await pressButton(1);
    expect(alertStore.getSnapshot()?.title).toBe('秘密结果');
    expect(submit).not.toHaveBeenCalled();

    await pressButton(0);
    expect(submit).toHaveBeenCalledWith({
      stepId: 'first',
      serial: 1,
      actionKey: 'view',
    });
  });

  it('opens the generic card picker and confirms the selected card index', async () => {
    const action: PresentedAction = {
      kind: 'pickCard',
      key: 'pick',
      label: '选择卡牌',
      availability: { kind: 'available' },
      cards: [{ index: 4, label: '一张卡牌', unavailableReason: null }],
      hint: null,
    };
    const { result, submit } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    expect(result.current.cardPicker?.cards).toEqual(action.cards);
    act(() => result.current.cardPicker?.onPick(4));
    await pressButton(1);

    expect(submit).toHaveBeenCalledWith({
      stepId: 'first',
      serial: 1,
      actionKey: 'pick',
      cardIndex: 4,
    });
    expect(result.current.cardPicker).toBeNull();
  });

  it('closes the card picker when the active step changes', () => {
    const action: PresentedAction = {
      kind: 'pickCard',
      key: 'pick',
      label: '选择卡牌',
      availability: { kind: 'available' },
      cards: [{ index: 4, label: '一张卡牌', unavailableReason: null }],
      hint: null,
    };
    const { result, rerender } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    expect(result.current.cardPicker).not.toBeNull();

    rerender({
      currentPresentation: {
        ...EMPTY_PRESENTATION,
        stepId: 'second',
        serial: 2,
        actions: [action],
      },
    });
    expect(result.current.cardPicker).toBeNull();
  });

  it('does not show private results while interaction is suspended', () => {
    const presentation: StepPresentation = {
      ...EMPTY_PRESENTATION,
      pendingResult: { title: '结果', text: '你看到了结果' },
    };
    renderHook(() =>
      useStepInteraction({
        presentation,
        draftIdentity: { userId: 'user-1', roomId: 'room-1' },
        describeConfirmation: () => ({ title: '', body: null, tone: 'default' }),
        submit: vi.fn().mockResolvedValue(true),
        isSuspended: true,
        hasPendingCommand: false,
      }),
    );

    expect(alertStore.getSnapshot()).toBeNull();
  });

  it('dismisses confirmations when the active step changes', () => {
    const action: PresentedAction = {
      kind: 'direct',
      key: 'confirm',
      label: '执行',
      availability: { kind: 'available' },
    };
    const { result, rerender } = renderStepInteraction(action);
    pressRoomAction(result.current.actions[0]);
    expect(alertStore.getSnapshot()).not.toBeNull();

    rerender({
      currentPresentation: {
        ...EMPTY_PRESENTATION,
        stepId: 'second',
        serial: 2,
        actions: [action],
      },
    });
    expect(alertStore.getSnapshot()).toBeNull();
  });
});

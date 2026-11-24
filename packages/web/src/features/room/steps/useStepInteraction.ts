import {
  defineCopy,
  type PresentedAction,
  renderCopy,
  STEP_RESULT_ACK_ACTION_KEY,
  type StepPresentation,
  type StepSubmission,
} from '@game-judge/game-engine/platform/steps';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { confirmAction, confirmView } from '@/features/room/confirm';
import { useScopedAlert } from '@/features/room/hooks/useScopedAlert';
import { type ScopedDraft, useScopedDraft } from '@/features/room/hooks/useScopedDraft';
import { useSeatPicking } from '@/features/room/hooks/useSeatPicking';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import { COMMAND_IN_FLIGHT_REASON } from '@/features/room/model/RoomAction';
import { AUDIO_WAITING_LABEL } from '@/features/room/model/RoomPlayerActions';
import { TESTIDS } from '@/testids';
import { alertStore } from '@/utils/alert';
import { showDismissAlert } from '@/utils/alertPresets';

export type StepSelection = Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>;

export const STEP_CANCEL_SELECTION_ACTION_KEY = 'cancelSeatSelection';
const COPY = defineCopy({
  staleStep: '当前行动步骤已变化，请重新选择',
  notice: '提示',
  cancelSelection: '取消选座',
  actionUnavailable: '暂不可操作',
  seatUnavailable: '暂不可选',
  confirmAction: '确认{action}',
});

export interface StepConfirmation {
  readonly title: string;
  readonly body: string | null;
  readonly tone: 'default' | 'danger';
}

export interface StepDraftIdentity {
  readonly userId: string;
  readonly roomId: string;
}

export interface StepCardPickerModel {
  readonly title: string;
  readonly hint: string | null;
  readonly cards: Extract<PresentedAction, { readonly kind: 'pickCard' }>['cards'];
  readonly onPick: (cardIndex: number) => void;
  readonly onClose: () => void;
  readonly onAlertShown: (generation: number | null) => void;
}

export interface UseStepInteractionInput {
  readonly presentation: StepPresentation | null;
  /** Stable authenticated user and room identity for reload-safe seat drafts. */
  readonly draftIdentity: StepDraftIdentity;
  readonly describeConfirmation: (selection: StepSelection) => StepConfirmation;
  readonly submit: (submission: StepSubmission) => Promise<boolean>;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  /** Game-level step position; engine progress counts actors, not night steps. */
  readonly progress?: NightStepProgress | null;
}

export interface StepInteraction {
  readonly message: string | null;
  readonly progress: NightStepProgress | null;
  readonly completionProgress: StepPresentation['progress'];
  readonly actions: readonly RoomPlayerAction[];
  readonly seatSelection: {
    readonly eligible: readonly number[];
    readonly selected: readonly number[];
    readonly unavailableReasons: Readonly<Record<number, string>>;
  } | null;
  readonly onSeatTap: (seat: number) => boolean;
  readonly cardPicker: StepCardPickerModel | null;
}

interface StepSelectionDraft {
  readonly actionKey: string | null;
  readonly seats: readonly number[];
}

const EMPTY_STEP_SELECTION_DRAFT: StepSelectionDraft = { actionKey: null, seats: [] };

function parseStepSelectionDraft(value: unknown): StepSelectionDraft {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('actionKey' in value) ||
    !(
      value.actionKey === null ||
      (typeof value.actionKey === 'string' && value.actionKey !== '')
    ) ||
    !('seats' in value) ||
    !Array.isArray(value.seats) ||
    value.seats.some((seat) => !Number.isInteger(seat) || seat < 0) ||
    new Set(value.seats).size !== value.seats.length
  ) {
    throw new Error('Stored step selection draft is invalid');
  }
  return { actionKey: value.actionKey, seats: value.seats };
}

/**
 * Adapts the shared engine presentation to room-hand actions and seat-board interaction.
 */
export function useStepInteraction(input: UseStepInteractionInput): StepInteraction {
  const {
    presentation,
    draftIdentity,
    describeConfirmation,
    submit,
    isSuspended,
    hasPendingCommand,
    progress = null,
  } = input;
  const contextKey =
    presentation === null ? 'inactive' : `${presentation.stepId}:${presentation.serial}`;
  const { trackAlert, trackConfirmation, clearConfirmation } =
    useStepConfirmationAlerts(contextKey);
  const cardPickerState = useStepCardPickerState(contextKey);
  const selectionDraft = useStepSelectionDraft(presentation, draftIdentity);
  const activeAction = findActiveSeatAction(presentation, selectionDraft.draft.actionKey);
  const seatPicking = useStepSeatSelection({
    presentation,
    activeAction,
    selectionDraft,
    isSuspended,
    hasPendingCommand,
    trackAlert,
  });
  const resetSeatSelection = seatPicking.reset;
  const selectedSeats = seatPicking.selection;
  const setSelectionDraft = selectionDraft.setDraft;
  const openCardPicker = cardPickerState.open;
  useClearStaleStepSelectionDraft(presentation, activeAction, selectionDraft);
  const submitSelection = useStepSubmission({
    presentation,
    isSuspended,
    hasPendingCommand,
    selectionDraft,
    submit,
    closeCardPicker: cardPickerState.close,
  });

  const requestConfirmation = useStepConfirmation({
    presentation,
    isSuspended,
    hasPendingCommand,
    describeConfirmation,
    resetSeatSelection,
    submitSelection,
    trackConfirmation,
    clearConfirmation,
  });

  const handleActionPress = useCallback(
    (action: PresentedAction) => {
      if (action.kind === 'direct') {
        requestConfirmation(action);
        return;
      }
      if (action.kind === 'view') {
        const acknowledge = action.isAcknowledged
          ? undefined
          : () => submitSelection(action.key).then(() => undefined);
        confirmView({
          label: action.label,
          onView: () => {
            clearConfirmation();
            showDismissAlert(action.content.title, action.content.text, acknowledge, trackAlert);
          },
          onShown: trackConfirmation,
        });
        return;
      }
      if (action.kind === 'pickCard') {
        openCardPicker(action.key);
        return;
      }
      if (activeAction?.key === action.key && selectedSeats.length >= action.min) {
        requestConfirmation(action, { seats: selectedSeats });
        return;
      }
      if (presentation !== null) {
        setSelectionDraft({
          actionKey: action.key,
          seats: activeAction?.key === action.key ? selectedSeats : [],
        });
      }
    },
    [
      activeAction,
      clearConfirmation,
      presentation,
      requestConfirmation,
      openCardPicker,
      selectedSeats,
      setSelectionDraft,
      submitSelection,
      trackAlert,
      trackConfirmation,
    ],
  );

  const actions = buildStepActions({
    presentation,
    activeAction,
    selectedSeats,
    isSuspended,
    hasPendingCommand,
    handleActionPress,
    clearSelection: selectionDraft.clear,
  });
  useStepInteractionEffects({
    activeAction,
    selectedSeats,
    requestConfirmation,
    presentation,
    contextKey,
    isSuspended,
    hasPendingCommand,
    submitSelection,
    trackAlert,
  });

  const cardPicker = buildCardPickerModel(
    presentation,
    cardPickerState.actionKey,
    cardPickerState.close,
    requestConfirmation,
    trackAlert,
  );

  return {
    message: presentation?.message ?? null,
    progress,
    completionProgress: presentation?.progress ?? null,
    actions,
    seatSelection: seatPicking.model,
    onSeatTap: seatPicking.onSeatTap,
    cardPicker,
  };
}

function useStepConfirmationAlerts(contextKey: string) {
  const confirmationGeneration = useRef<number | null>(null);
  const onStale = useCallback((generation: number) => {
    if (confirmationGeneration.current !== generation) return;
    confirmationGeneration.current = null;
    showDismissAlert(COPY.notice, COPY.staleStep);
  }, []);
  const trackAlert = useScopedAlert(contextKey, onStale);
  const trackConfirmation = useCallback(
    (generation: number | null) => {
      confirmationGeneration.current = generation;
      trackAlert(generation);
    },
    [trackAlert],
  );
  const clearConfirmation = useCallback(() => {
    confirmationGeneration.current = null;
  }, []);
  return { trackAlert, trackConfirmation, clearConfirmation };
}

function useStepConfirmation(input: {
  readonly presentation: StepPresentation | null;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly describeConfirmation: UseStepInteractionInput['describeConfirmation'];
  readonly resetSeatSelection: () => void;
  readonly submitSelection: (
    actionKey: string,
    selection?: Omit<StepSelection, 'actionKey'>,
  ) => Promise<boolean>;
  readonly trackConfirmation: (generation: number | null) => void;
  readonly clearConfirmation: () => void;
}) {
  const {
    presentation,
    isSuspended,
    hasPendingCommand,
    describeConfirmation,
    resetSeatSelection,
    submitSelection,
    trackConfirmation,
    clearConfirmation,
  } = input;
  return useCallback(
    (action: PresentedAction, selection: Omit<StepSelection, 'actionKey'> = {}) => {
      if (isSuspended || hasPendingCommand || presentation === null) return;
      const described = describeConfirmation({ actionKey: action.key, ...selection });
      confirmAction({
        label: described.title,
        body: described.body ?? undefined,
        tone: described.tone,
        confirmText: described.tone === 'danger' ? action.label : undefined,
        onCancel: () => {
          if (action.kind === 'pickSeats') resetSeatSelection();
        },
        onConfirm: async () => {
          clearConfirmation();
          const accepted = await submitSelection(action.key, selection);
          if (!accepted && action.kind === 'pickSeats') resetSeatSelection();
        },
        onShown: trackConfirmation,
      });
    },
    [
      clearConfirmation,
      describeConfirmation,
      hasPendingCommand,
      isSuspended,
      presentation,
      resetSeatSelection,
      submitSelection,
      trackConfirmation,
    ],
  );
}

function buildStepActions(input: {
  readonly presentation: StepPresentation | null;
  readonly activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null;
  readonly selectedSeats: readonly number[];
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly handleActionPress: (action: PresentedAction) => void;
  readonly clearSelection: () => void;
}): readonly RoomPlayerAction[] {
  const { presentation, activeAction, selectedSeats, isSuspended, hasPendingCommand } = input;
  const actions = projectActions({
    actions: presentation?.pendingResult === null ? (presentation?.actions ?? []) : [],
    activeAction,
    selectedSeats,
    isSuspended,
    hasPendingCommand,
    onPress: input.handleActionPress,
  });
  if (activeAction === null) return actions;
  return [
    ...(activeAction.min === activeAction.max
      ? []
      : actions.filter((action) => action.key === activeAction.key)),
    {
      key: STEP_CANCEL_SELECTION_ACTION_KEY,
      label: COPY.cancelSelection,
      audience: 'participant',
      category: 'player',
      icon: 'arrow-back',
      testID: TESTIDS.stepInteractionButton(STEP_CANCEL_SELECTION_ACTION_KEY),
      state: { kind: 'ready', onPress: input.clearSelection },
    },
  ];
}

function buildCardPickerModel(
  presentation: StepPresentation | null,
  actionKey: string | null,
  onClose: () => void,
  requestConfirmation: (
    action: PresentedAction,
    selection?: Omit<StepSelection, 'actionKey'>,
  ) => void,
  onAlertShown: (generation: number | null) => void,
): StepCardPickerModel | null {
  const action = findCardAction(presentation, actionKey);
  if (action === null) return null;
  return {
    title: action.label,
    hint: action.hint,
    cards: action.cards,
    onPick: (cardIndex) => requestConfirmation(action, { cardIndex }),
    onClose,
    onAlertShown,
  };
}

function useStepInteractionEffects(input: {
  readonly activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null;
  readonly selectedSeats: readonly number[];
  readonly requestConfirmation: (
    action: PresentedAction,
    selection?: Omit<StepSelection, 'actionKey'>,
  ) => void;
  readonly presentation: StepPresentation | null;
  readonly contextKey: string;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly submitSelection: (actionKey: string) => Promise<boolean>;
  readonly trackAlert: (generation: number | null) => void;
}): void {
  const {
    activeAction,
    selectedSeats,
    requestConfirmation,
    presentation,
    contextKey,
    isSuspended,
    hasPendingCommand,
    submitSelection,
    trackAlert,
  } = input;
  const alert = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
  useAutoConfirmSeatPick(
    activeAction,
    selectedSeats,
    requestConfirmation,
    contextKey,
    isSuspended || hasPendingCommand || alert !== null,
  );
  usePendingResultAcknowledgement({
    presentation,
    contextKey,
    isSuspended,
    hasPendingCommand,
    submitSelection,
    trackAlert,
    hasOpenAlert: alert !== null,
  });
}

function useStepCardPickerState(contextKey: string) {
  const [selection, setSelection] = useState<{
    readonly contextKey: string;
    readonly actionKey: string;
  } | null>(null);
  if (selection !== null && selection.contextKey !== contextKey) setSelection(null);
  const open = useCallback(
    (actionKey: string) => setSelection({ contextKey, actionKey }),
    [contextKey],
  );
  const close = useCallback(() => setSelection(null), []);
  return {
    actionKey: selection?.contextKey === contextKey ? selection.actionKey : null,
    open,
    close,
  };
}

function useStepSubmission(input: {
  readonly presentation: StepPresentation | null;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly selectionDraft: ScopedDraft<StepSelectionDraft>;
  readonly submit: (submission: StepSubmission) => Promise<boolean>;
  readonly closeCardPicker: () => void;
}): (actionKey: string, selection?: Omit<StepSelection, 'actionKey'>) => Promise<boolean> {
  const { presentation, isSuspended, hasPendingCommand, selectionDraft, submit, closeCardPicker } =
    input;
  const clearSelectionDraft = selectionDraft.clear;
  const selectionActionKey = selectionDraft.draft.actionKey;
  return useCallback(
    async (actionKey, selection = {}) => {
      if (presentation === null || isSuspended || hasPendingCommand) return false;
      const accepted = await submit({
        stepId: presentation.stepId,
        serial: presentation.serial,
        actionKey,
        ...selection,
      });
      if (accepted) {
        closeCardPicker();
        if (selectionActionKey === actionKey) clearSelectionDraft();
      }
      return accepted;
    },
    [
      hasPendingCommand,
      isSuspended,
      presentation,
      clearSelectionDraft,
      selectionActionKey,
      closeCardPicker,
      submit,
    ],
  );
}

function useStepSelectionDraft(
  presentation: StepPresentation | null,
  draftIdentity: StepDraftIdentity,
): ScopedDraft<StepSelectionDraft> {
  const scope = useMemo(
    () => ({
      stepId: presentation?.stepId ?? 'inactive',
      serial: presentation?.serial ?? -1,
      userId: draftIdentity.userId,
      roomId: draftIdentity.roomId,
    }),
    [draftIdentity.roomId, draftIdentity.userId, presentation?.serial, presentation?.stepId],
  );
  return useScopedDraft({
    namespace: 'step-action-selection',
    userId: draftIdentity.userId,
    roomId: draftIdentity.roomId,
    scope,
    initial: EMPTY_STEP_SELECTION_DRAFT,
    parse: parseStepSelectionDraft,
  });
}

function useClearStaleStepSelectionDraft(
  presentation: StepPresentation | null,
  activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null,
  selectionDraft: ScopedDraft<StepSelectionDraft>,
): void {
  const selectionActionKey = selectionDraft.draft.actionKey;
  const clearSelectionDraft = selectionDraft.clear;
  useEffect(() => {
    if (presentation !== null && selectionActionKey !== null && activeAction === null) {
      clearSelectionDraft();
    }
  }, [activeAction, clearSelectionDraft, presentation, selectionActionKey]);
}

function findActiveSeatAction(
  presentation: StepPresentation | null,
  actionKey: string | null,
): Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null {
  if (presentation === null || actionKey === null) return null;
  return (
    presentation.actions.find(
      (action): action is Extract<PresentedAction, { readonly kind: 'pickSeats' }> =>
        action.key === actionKey && action.kind === 'pickSeats',
    ) ?? null
  );
}

function useStepSeatSelection(input: {
  readonly presentation: StepPresentation | null;
  readonly activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null;
  readonly selectionDraft: ScopedDraft<StepSelectionDraft>;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly trackAlert: (generation: number | null) => void;
}) {
  const { presentation, activeAction, selectionDraft, isSuspended, hasPendingCommand, trackAlert } =
    input;
  const picking = useSeatPicking({
    active: activeAction !== null && !isSuspended && !hasPendingCommand,
    mode: activeAction?.max === 1 ? 'replace' : 'toggle',
    eligibleSeats:
      activeAction?.seats
        .filter((option) => option.unavailableReason === null)
        .map((option) => option.seat) ?? [],
    maxSize: activeAction?.max,
    ineligibleTap: 'swallow',
    anchorKey:
      activeAction === null || presentation === null
        ? null
        : `${presentation.stepId}:${presentation.serial}:${activeAction.key}`,
    storage: {
      kind: 'room',
      selection:
        selectionDraft.draft.actionKey === activeAction?.key ? selectionDraft.draft.seats : [],
      onSelectionChange: (seats) =>
        activeAction === null
          ? undefined
          : selectionDraft.setDraft({ actionKey: activeAction.key, seats }),
    },
  });
  const selectedSeats = picking.selection;
  const handlePickingSeatTap = picking.handleSeatTap;
  const setSelectionDraft = selectionDraft.setDraft;
  const clearSelectionDraft = selectionDraft.clear;
  const model = useMemo(() => {
    if (activeAction === null) return null;
    return {
      eligible: activeAction.seats
        .filter((option) => option.unavailableReason === null)
        .map((option) => option.seat),
      selected: selectedSeats,
      unavailableReasons: Object.fromEntries(
        activeAction.seats.flatMap((option) =>
          option.unavailableReason === null ? [] : [[option.seat, option.unavailableReason]],
        ),
      ),
    };
  }, [activeAction, selectedSeats]);
  const onSeatTap = useCallback(
    (seat: number): boolean => {
      if (model === null || activeAction === null) return false;
      if (isSuspended || hasPendingCommand) {
        showDismissAlert(
          COPY.actionUnavailable,
          isSuspended ? AUDIO_WAITING_LABEL : COMMAND_IN_FLIGHT_REASON,
          undefined,
          trackAlert,
        );
        return true;
      }
      const reason = model.unavailableReasons[seat];
      if (reason !== undefined) {
        showDismissAlert(COPY.seatUnavailable, reason, undefined, trackAlert);
        return true;
      }
      return handlePickingSeatTap(seat);
    },
    [activeAction, handlePickingSeatTap, hasPendingCommand, isSuspended, model, trackAlert],
  );
  const reset = useCallback(() => {
    if (activeAction === null) {
      clearSelectionDraft();
      return;
    }
    setSelectionDraft({ actionKey: activeAction.key, seats: [] });
  }, [activeAction, clearSelectionDraft, setSelectionDraft]);
  return { ...picking, model, onSeatTap, reset };
}

function projectActions(input: {
  readonly actions: readonly PresentedAction[];
  readonly activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null;
  readonly selectedSeats: readonly number[];
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly onPress: (action: PresentedAction) => void;
}): readonly RoomPlayerAction[] {
  return input.actions.map((action) => {
    const unavailableReason =
      action.availability.kind === 'unavailable' ? action.availability.reason : null;
    const reason = input.isSuspended
      ? AUDIO_WAITING_LABEL
      : input.hasPendingCommand
        ? COMMAND_IN_FLIGHT_REASON
        : unavailableReason;
    const state =
      reason === null
        ? { kind: 'ready' as const, onPress: () => input.onPress(action) }
        : { kind: 'blocked' as const, reason };
    const isReadyToConfirm =
      action.kind === 'pickSeats' &&
      input.activeAction?.key === action.key &&
      input.selectedSeats.length >= action.min;
    return {
      key: action.key,
      label: isReadyToConfirm
        ? renderCopy(COPY.confirmAction, { action: action.label })
        : action.label,
      audience: 'participant',
      category: 'player',
      icon: getActionIcon(action),
      opensDialog: action.kind !== 'pickSeats',
      ...(unavailableReason === null ? {} : { showBlockedReason: true }),
      testID: TESTIDS.stepInteractionButton(action.key),
      state,
    };
  });
}

function getActionIcon(action: PresentedAction): RoomPlayerAction['icon'] {
  if (action.kind === 'view') return 'eye-outline';
  if (action.kind === 'pickCard') return 'albums-outline';
  if (action.kind === 'direct') return 'checkmark-circle-outline';
  return 'hand-left-outline';
}

function findCardAction(
  presentation: StepPresentation | null,
  cardPickerKey: string | null,
): Extract<PresentedAction, { readonly kind: 'pickCard' }> | null {
  if (presentation === null || cardPickerKey === null) return null;
  return (
    presentation.actions.find(
      (action): action is Extract<PresentedAction, { readonly kind: 'pickCard' }> =>
        action.kind === 'pickCard' && action.key === cardPickerKey,
    ) ?? null
  );
}

function useAutoConfirmSeatPick(
  activeAction: Extract<PresentedAction, { readonly kind: 'pickSeats' }> | null,
  selectedSeats: readonly number[],
  requestConfirmation: (
    action: PresentedAction,
    selection?: Omit<StepSelection, 'actionKey'>,
  ) => void,
  contextKey: string,
  isBlocked: boolean,
): void {
  const previousKey = useRef<string | null>(null);
  const confirmationKey =
    activeAction !== null && activeAction.max > 0 && selectedSeats.length === activeAction.max
      ? `${contextKey}:${activeAction.key}:${selectedSeats.join(',')}`
      : null;
  useEffect(() => {
    if (confirmationKey === null) {
      previousKey.current = null;
      return;
    }
    if (isBlocked || confirmationKey === previousKey.current || activeAction === null) return;
    previousKey.current = confirmationKey;
    requestConfirmation(activeAction, { seats: selectedSeats });
  }, [activeAction, confirmationKey, isBlocked, requestConfirmation, selectedSeats]);
}

function usePendingResultAcknowledgement(input: {
  readonly presentation: StepPresentation | null;
  readonly contextKey: string;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly submitSelection: (actionKey: string) => Promise<boolean>;
  readonly trackAlert: (generation: number | null) => void;
  readonly hasOpenAlert: boolean;
}): void {
  const {
    presentation,
    contextKey,
    isSuspended,
    hasPendingCommand,
    submitSelection,
    trackAlert,
    hasOpenAlert,
  } = input;
  const acknowledgedResultKey = useRef<string | null>(null);
  useEffect(() => {
    const result = presentation?.pendingResult ?? null;
    if (result === null) {
      acknowledgedResultKey.current = null;
      return;
    }
    if (isSuspended || hasPendingCommand || hasOpenAlert) return;
    const resultKey = `${contextKey}:${result.title}:${result.text}`;
    if (acknowledgedResultKey.current === resultKey) return;
    showDismissAlert(
      result.title,
      result.text,
      async () => {
        if (await submitSelection(STEP_RESULT_ACK_ACTION_KEY)) {
          acknowledgedResultKey.current = resultKey;
        }
      },
      trackAlert,
    );
  }, [
    contextKey,
    hasOpenAlert,
    hasPendingCommand,
    isSuspended,
    presentation?.pendingResult,
    submitSelection,
    trackAlert,
  ]);
}

/**
 * useNightInteraction — the actioner's night step as data, plus the
 * imperative edges: confirm dialogs, pending reveals, submit.
 *
 * Model: `resolveNightInteraction(viewModel, draft)` — the engine's
 * projection decides who acts and on whom; this hook only keeps the
 * selection mode and its step-scoped draft, plus dialog/prompt bookkeeping. Every command
 * goes through the shared single-flight `submit`; night actions are
 * durable and carry `expectedStep`. Domain rejections are presented
 * from the state the engine committed (`night.rejection`), once per
 * `rejectionId`, so a reloaded client still sees them.
 */

import {
  type GameState,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useScopedAlert } from '@/features/room/hooks/useScopedAlert';
import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import { resolveSeatPickTap } from '@/features/room/model/seatPicking';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';
import { roomScreenLog } from '@/utils/logger';

import {
  buildNightCommand,
  isDurableNightCommand,
  type NightConfirmation,
} from '../night/buildNightCommand';
import type { NightInteractionModel } from '../night/NightInteractionModel';
import {
  describeNightSeatConfirmation,
  describeNightSeatSelection,
  nightSeatAction,
  type NightSeatSelection,
} from '../night/nightSeatSelection';
import {
  renderActionerMessage,
  resolveNightInteraction,
  wolfCountdownFragment,
  wolfStatusLine,
} from '../night/resolveNightInteraction';
import type { NightButtonAction } from '../werewolfRoomAdapter';

const NIGHT_ACTION_LABEL = '操作';
const SKIP_CONFIRM_TITLE = '跳过本次行动？';
const SKIP_CONFIRM_TEXT = '确定跳过本次行动吗？';
const WOLF_WITHDRAW_CONFIRM_TITLE = '取消投票？';
const WOLF_WITHDRAW_CONFIRM_TEXT = '撤回你当前的袭击投票。';
/** Minimum interval between two blocked-tap toasts. */
const BLOCKED_TOAST_THROTTLE_MS = 3000;

interface NightChooseCardModal {
  readonly model: Extract<NightInteractionModel, { kind: 'chooseCard' }>;
  readonly close: () => void;
  readonly choose: (cardIndex: number) => Promise<void>;
}

export interface NightInteraction {
  readonly model: NightInteractionModel;
  readonly actionGroupKey: string;
  /** The actioner's bottom message; null for non-actioners. */
  readonly actionMessage: string | null;
  /** The wolf settle countdown line, visible while audio playback blocks the interaction model; null otherwise. */
  readonly nightStatusLine: string | null;
  readonly seatSelection: NightSeatSelection | null;
  /** Consumes an in-game seat tap; false lets the shared handler apply. */
  readonly onSeatTap: (seat: number) => boolean;
  readonly onNightButton: (action: NightButtonAction, actionKey: string) => void;
  readonly chooseCardModal: NightChooseCardModal | null;
}

interface UseNightInteractionInput {
  readonly isReadingRoomInformation: boolean;
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly userId: string;
  readonly roomId: string;
  readonly controlledSeat: number | null;
  readonly effectiveSeat: number | null;
  /** The host's audio-resume gate is up: no prompts until it closes. */
  readonly isAudioResumeDue: boolean;
  readonly hasPendingCommand: boolean;
  readonly nowMs: number;
  readonly submit: WerewolfSubmit;
}

function confirmationLabel(confirmation: NightConfirmation): string {
  switch (confirmation.kind) {
    case 'ack':
      return '确认';
    case 'skip':
      return '跳过';
    default:
      return NIGHT_ACTION_LABEL;
  }
}

export function useNightInteraction(input: UseNightInteractionInput): NightInteraction {
  const { state, viewModel, controlledSeat, effectiveSeat, submit } = input;
  const stepId = state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : null;
  const roleRevealRandomNonce = state.roleRevealRandomNonce ?? null;
  const scopeKey = JSON.stringify([
    input.roomId,
    input.userId,
    state.status,
    stepId,
    effectiveSeat,
    roleRevealRandomNonce,
  ]);
  const [picking, setPicking] = useState<{
    readonly scope: string;
    readonly seats: readonly number[];
  } | null>(null);
  if (picking !== null && picking.scope !== scopeKey) setPicking(null);

  const model = useMemo(
    () =>
      resolveNightInteraction({
        viewModel,
        locks: { isAudioPlaying: state.isAudioPlaying, hasPendingCommand: input.hasPendingCommand },
        nowMs: input.nowMs,
      }),
    [viewModel, state.isAudioPlaying, input.hasPendingCommand, input.nowMs],
  );

  /**
   * The settle countdown while audio playback blocks the model: the
   * countdown is status information, not an action affordance, so it
   * stays visible through the lock. Gated on the armed countdown, the
   * same conditions the wolf status line uses.
   */
  const nightStatusLine = useMemo(() => {
    if (model.kind !== 'blocked' || model.reason !== AUDIO_PLAYBACK_LOCK_REASON) return null;
    const wolfVote = viewModel.night.wolfVote;
    if (wolfVote === null) return null;
    if (wolfCountdownFragment(wolfVote, input.nowMs) === null) return null;
    return wolfStatusLine(wolfVote, input.nowMs);
  }, [input.nowMs, model, viewModel]);

  /**
   * Submit one confirmation. `surface: 'dialog'` is the retry contract:
   * a transport failure toasts and rethrows so the open dialog stays up for
   * another tap (AlertHost keeps an alert whose callback rejects); a
   * decision closes it. Business rejections are presented from state.
   */
  const dispatch = useCallback(
    async (
      confirmation: NightConfirmation,
      surface: 'dialog' | 'button',
      actionKey: string | null,
    ): Promise<boolean> => {
      if (stepId === null) {
        throw new Error('[FAIL-FAST] Night confirmation outside a night step');
      }
      const command = buildNightCommand(model, confirmation, { stepId, roleRevealRandomNonce });
      const ok = await submit(confirmationLabel(confirmation), command, {
        controlledSeat,
        durable: isDurableNightCommand(command),
        actionKey,
        domainRejection: 'state',
        transportFailure: surface === 'dialog' ? 'toastAndRethrow' : 'alert',
      });
      if (ok) {
        setPicking(null);
      }
      return ok;
    },
    [controlledSeat, model, roleRevealRandomNonce, setPicking, stepId, submit],
  );

  /** A dialog callback that submits one confirmation. */
  const confirmWith = useCallback(
    (confirmation: NightConfirmation, actionKey: string | null) => (): Promise<void> =>
      dispatch(confirmation, 'dialog', actionKey).then(() => undefined),
    [dispatch],
  );

  // ── Domain rejections, presented from state once per rejectionId ──
  const lastRejectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const rejection = viewModel.night.rejection;
    if (rejection === null) {
      lastRejectionIdRef.current = null;
      return;
    }
    if (input.isReadingRoomInformation || rejection.rejectionId === lastRejectionIdRef.current)
      return;
    lastRejectionIdRef.current = rejection.rejectionId;
    roomScreenLog.warn('Night action rejected', rejection);
    showDismissAlert(`${NIGHT_ACTION_LABEL}失败`, rejection.reason);
  }, [input.isReadingRoomInformation, viewModel.night.rejection]);

  // ── Seat taps ──
  const seatSelection =
    picking?.scope === scopeKey ? describeNightSeatSelection(model, picking.seats) : null;
  const selectionInput = seatSelection?.confirm?.input ?? null;
  const disclosureContentKey =
    model.kind === 'confirmStatus' || model.kind === 'ackHunterStatus'
      ? JSON.stringify([model.dialog.title, model.dialog.text])
      : model.kind === 'ackGroupReveal'
        ? JSON.stringify([model.text.title, model.text.text])
        : null;
  const alertContextKey = JSON.stringify([
    scopeKey,
    model.kind,
    selectionInput,
    disclosureContentKey,
  ]);
  const trackAlert = useScopedAlert(alertContextKey);

  // ── An owed reveal acknowledgement, once per step scope ──
  const promptedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (input.isAudioResumeDue || input.isReadingRoomInformation || model.kind !== 'ackReveal')
      return;
    const key = `${scopeKey}|ackReveal`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    showDismissAlert(
      model.title,
      model.reveal.result,
      confirmWith({ kind: 'ack' }, null),
      trackAlert,
    );
  }, [
    confirmWith,
    input.isAudioResumeDue,
    input.isReadingRoomInformation,
    model,
    scopeKey,
    trackAlert,
  ]);

  const latestSeatSelectionRef = useRef({ scopeKey, model, seatSelection });
  useEffect(() => {
    latestSeatSelectionRef.current = { scopeKey, model, seatSelection };
  }, [scopeKey, model, seatSelection]);
  const seatAction = nightSeatAction(model);
  const confirmSelection = useCallback(
    (selection: NightSeatSelection) => {
      if (selection.confirm === null) {
        throw new Error('[FAIL-FAST] Cannot submit an incomplete night seat selection');
      }
      const confirmation = describeNightSeatConfirmation(model, selection);
      const confirmedInput = selection.confirm.input;
      const clearOnCancel = (nightSeatAction(model)?.max ?? 0) > 1;
      const selectionAlertContextKey = JSON.stringify([
        scopeKey,
        model.kind,
        confirmedInput,
        disclosureContentKey,
      ]);
      showConfirmAlert(
        confirmation.title,
        confirmation.text,
        async () => {
          const latest = latestSeatSelectionRef.current;
          if (
            latest.scopeKey !== scopeKey ||
            latest.seatSelection?.confirm == null ||
            JSON.stringify(latest.seatSelection.confirm.input) !== JSON.stringify(confirmedInput) ||
            JSON.stringify(describeNightSeatConfirmation(latest.model, latest.seatSelection)) !==
              JSON.stringify(confirmation)
          ) {
            toast.error('当前行动或目标已变化，请重新选择。');
            return;
          }
          // Seat-selection confirmations show progress on the dialog, not on a hand card.
          await dispatch(confirmedInput, 'dialog', null);
        },
        {
          onCancel: clearOnCancel
            ? () => {
                if (latestSeatSelectionRef.current.scopeKey === scopeKey) {
                  setPicking({ scope: scopeKey, seats: [] });
                }
              }
            : undefined,
          onShown: (generation) => trackAlert(generation, selectionAlertContextKey),
        },
      );
    },
    [dispatch, disclosureContentKey, model, scopeKey, trackAlert, setPicking],
  );

  const blockedToastAtRef = useRef(0);
  const onSeatTap = useCallback(
    (seat: number): boolean => {
      if (
        model.kind === 'wolfVote' &&
        model.seatTapMessage !== null &&
        model.selectable.includes(seat)
      ) {
        showDismissAlert(model.prompt.title, model.seatTapMessage);
        return true;
      }
      switch (model.kind) {
        case 'blocked': {
          const now = Date.now();
          if (now - blockedToastAtRef.current >= BLOCKED_TOAST_THROTTLE_MS) {
            blockedToastAtRef.current = now;
            toast.info(model.reason);
          }
          return true;
        }
        case 'pickSeat':
        case 'wolfVote':
        case 'pickTwoSeats':
        case 'witch':
        case 'multiSelect': {
          if (seatSelection === null) return false;
          const result = resolveSeatPickTap({
            seat,
            eligibleSeats: seatSelection.eligible,
            mode:
              model.kind === 'pickTwoSeats' || model.kind === 'multiSelect' ? 'toggle' : 'replace',
            selection: seatSelection.seats,
            ineligibleTap: 'swallow',
          });
          if (result.kind === 'consumed') {
            setPicking({ scope: scopeKey, seats: result.nextSelection });
            const nextSelection = describeNightSeatSelection(model, result.nextSelection);
            if (
              seatAction !== null &&
              seatAction.min === seatAction.max &&
              nextSelection?.confirm !== null &&
              nextSelection !== null
            ) {
              confirmSelection(nextSelection);
            }
          }
          return true;
        }
        case 'idle':
        case 'ackReveal':
        case 'ackGroupReveal':
        case 'ackHunterStatus':
        case 'confirmStatus':
        case 'chooseCard':
        case 'skipOnly':
          return false;
      }
    },
    [confirmSelection, model, scopeKey, seatAction, seatSelection, setPicking],
  );

  const showPrivateStatus = useCallback(
    (title: string, text: string, confirmation: NightConfirmation, actionKey: string) => {
      const isCurrent = (): boolean => {
        const latest = latestSeatSelectionRef.current;
        if (latest.scopeKey !== scopeKey || latest.model.kind !== model.kind) return false;
        switch (latest.model.kind) {
          case 'confirmStatus':
          case 'ackHunterStatus':
            return latest.model.dialog.title === title && latest.model.dialog.text === text;
          case 'ackGroupReveal':
            return (
              !latest.model.hasAcked &&
              latest.model.text.title === title &&
              latest.model.text.text === text
            );
          default:
            return false;
        }
      };
      const checkCurrent = (): boolean => {
        if (isCurrent()) return true;
        toast.error('当前状态已变化，请重新查看。');
        return false;
      };
      showConfirmAlert(
        '查看状态？',
        '确定查看你的私密状态吗？',
        () => {
          if (!checkCurrent()) return;
          showDismissAlert(
            title,
            text,
            async () => {
              if (checkCurrent()) await confirmWith(confirmation, actionKey)();
            },
            trackAlert,
          );
        },
        { confirmText: '查看', onShown: trackAlert },
      );
    },
    [confirmWith, model.kind, scopeKey, trackAlert],
  );

  // ── Bottom buttons ──
  // Open for one step: a step change makes the stored key stale (no reset effect).
  const [chooseCardOpenStepId, setChooseCardOpenStepId] = useState<string | null>(null);
  const isChooseCardOpen = model.kind === 'chooseCard' && chooseCardOpenStepId === stepId;

  const onNightButton = useCallback(
    (action: NightButtonAction, actionKey: string): void => {
      switch (action.kind) {
        case 'startSeatSelection':
          if (nightSeatAction(model) === null) throw illegalButton(action, model);
          setPicking({ scope: scopeKey, seats: [] });
          return;
        case 'cancelSeatSelection':
          setPicking(null);
          return;
        case 'submitSeatSelection': {
          if (seatSelection?.confirm == null) throw illegalButton(action, model);
          confirmSelection(seatSelection);
          return;
        }
        case 'skip':
          showConfirmAlert(
            SKIP_CONFIRM_TITLE,
            SKIP_CONFIRM_TEXT,
            confirmWith({ kind: 'skip' }, actionKey),
            {
              onShown: trackAlert,
            },
          );
          return;
        case 'emptyVote':
          if (model.kind !== 'wolfVote') throw illegalButton(action, model);
          showConfirmAlert(
            model.confirmTitle,
            model.emptyVoteConfirmText,
            confirmWith({ kind: 'emptyVote' }, actionKey),
            { onShown: trackAlert },
          );
          return;
        case 'withdrawVote':
          if (model.kind !== 'wolfVote') throw illegalButton(action, model);
          showConfirmAlert(
            WOLF_WITHDRAW_CONFIRM_TITLE,
            WOLF_WITHDRAW_CONFIRM_TEXT,
            confirmWith({ kind: 'withdrawVote' }, actionKey),
            { onShown: trackAlert },
          );
          return;
        case 'save':
          if (model.kind !== 'witch') throw illegalButton(action, model);
          showConfirmAlert(
            model.saveConfirmTitle,
            model.saveConfirmText,
            confirmWith({ kind: 'save' }, actionKey),
            { onShown: trackAlert },
          );
          return;
        case 'openStatus': {
          if (model.kind !== 'confirmStatus') throw illegalButton(action, model);
          if (model.status.role !== 'seedWolf') {
            showPrivateStatus(
              model.dialog.title,
              model.dialog.text,
              { kind: 'confirm' },
              actionKey,
            );
            return;
          }
          if (model.isUnavailable) throw illegalButton(action, model);
          showConfirmAlert(
            model.dialog.title,
            model.dialog.text,
            confirmWith({ kind: 'confirm' }, actionKey),
            { onShown: trackAlert },
          );
          return;
        }
        case 'openGroupReveal':
          if (model.kind !== 'ackGroupReveal') throw illegalButton(action, model);
          showPrivateStatus(model.text.title, model.text.text, { kind: 'ack' }, actionKey);
          return;
        case 'openHunterStatus':
          if (model.kind !== 'ackHunterStatus') throw illegalButton(action, model);
          showPrivateStatus(model.dialog.title, model.dialog.text, { kind: 'ack' }, actionKey);
          return;
        case 'openChooseCard':
          if (model.kind !== 'chooseCard') throw illegalButton(action, model);
          setChooseCardOpenStepId(stepId);
          return;
      }
    },
    [
      confirmWith,
      confirmSelection,
      setChooseCardOpenStepId,
      setPicking,
      trackAlert,
      model,
      scopeKey,
      seatSelection,
      showPrivateStatus,
      stepId,
    ],
  );

  const chooseCardModal = useMemo((): NightChooseCardModal | null => {
    if (model.kind !== 'chooseCard' || !isChooseCardOpen) return null;
    return {
      model,
      close: () => setChooseCardOpenStepId(null),
      choose: async (cardIndex) => {
        const ok = await dispatch({ kind: 'card', cardIndex }, 'button', null);
        if (ok) setChooseCardOpenStepId(null);
      },
    };
  }, [dispatch, isChooseCardOpen, model]);

  return {
    model,
    actionGroupKey: scopeKey,
    actionMessage:
      seatSelection === null
        ? renderActionerMessage(model, viewModel)
        : model.kind === 'wolfVote'
          ? `${seatSelection.message} · ${model.statusLine}`
          : model.kind === 'witch'
            ? `${renderActionerMessage(model, viewModel)}\n${seatSelection.message}`
            : seatSelection.message,
    nightStatusLine,
    seatSelection,
    onSeatTap,
    onNightButton,
    chooseCardModal,
  };
}

function illegalButton(action: NightButtonAction, model: NightInteractionModel): Error {
  return new Error(`[FAIL-FAST] Night button ${action.kind} pressed while model is ${model.kind}`);
}

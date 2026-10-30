/**
 * useNightInteraction — the actioner's night step as data, plus the
 * imperative edges: confirm dialogs, the once-per-step prompt, submit.
 *
 * Model: `resolveNightInteraction(viewModel, draft)` — the engine's
 * projection decides who acts and on whom; this hook only keeps the
 * local draft (magician first pick, multi-select set), the pending
 * second swap seat, and the dialog/prompt bookkeeping. Every command
 * goes through the shared single-flight `submit`; night actions are
 * durable and carry `expectedStep`. Domain rejections are presented
 * from the state the engine committed (`night.rejection`), once per
 * `rejectionId`, so a reloaded client still sees them.
 */

import {
  type GameState,
  getPlayerCount,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner-native';

import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';
import { roomScreenLog } from '@/utils/logger';

import {
  buildNightCommand,
  isDurableNightCommand,
  type NightConfirmation,
} from '../night/buildNightCommand';
import type { NightInteractionModel } from '../night/NightInteractionModel';
import { renderActionerMessage, resolveNightInteraction } from '../night/resolveNightInteraction';
import type { NightButtonAction } from '../werewolfRoomAdapter';
import { useNightDraft } from './useNightDraft';

const NIGHT_ACTION_LABEL = '操作';
const SKIP_CONFIRM_TITLE = '跳过本次行动？';
const SKIP_CONFIRM_TEXT = '确定跳过本次行动吗？';
const WOLF_WITHDRAW_CONFIRM_TITLE = '取消投票？';
const WOLF_WITHDRAW_CONFIRM_TEXT = '撤回你当前的袭击投票。';
const WOLF_IMMUNE_NOTE = '（该角色免疫狼人袭击）';
/** Minimum interval between two blocked-tap toasts. */
const BLOCKED_TOAST_THROTTLE_MS = 3000;

export interface NightChooseCardModal {
  readonly model: Extract<NightInteractionModel, { kind: 'chooseCard' }>;
  readonly close: () => void;
  readonly choose: (cardIndex: number) => Promise<void>;
}

export interface NightInteraction {
  readonly model: NightInteractionModel;
  /** The actioner's bottom message; null for non-actioners. */
  readonly actionMessage: string | null;
  /** Consumes an in-game seat tap; false lets the shared handler apply. */
  readonly onSeatTap: (seat: number) => boolean;
  readonly onNightButton: (action: NightButtonAction) => void;
  readonly chooseCardModal: NightChooseCardModal | null;
}

interface UseNightInteractionInput {
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

  const draft = useNightDraft({
    userId: input.userId,
    roomId: input.roomId,
    scope: {
      stepId,
      actorSeat: effectiveSeat,
      roleRevealRandomNonce,
      seatCount: getPlayerCount(state.templateRoles),
    },
  });
  const [swapSecond, setSwapSecond] = useState<{
    readonly stepId: string;
    readonly seat: number;
  } | null>(null);
  const swapSecondSeat =
    swapSecond !== null && swapSecond.stepId === stepId ? swapSecond.seat : null;

  const model = useMemo(
    () =>
      resolveNightInteraction({
        viewModel,
        draft: draft.draft,
        swapSecondSeat,
        locks: { isAudioPlaying: state.isAudioPlaying, hasPendingCommand: input.hasPendingCommand },
        nowMs: input.nowMs,
      }),
    [
      viewModel,
      draft.draft,
      swapSecondSeat,
      state.isAudioPlaying,
      input.hasPendingCommand,
      input.nowMs,
    ],
  );

  const dispatch = useCallback(
    async (confirmation: NightConfirmation): Promise<boolean> => {
      if (stepId === null) {
        throw new Error('[FAIL-FAST] Night confirmation outside a night step');
      }
      const command = buildNightCommand(model, confirmation, { stepId, roleRevealRandomNonce });
      const ok = await submit(confirmationLabel(confirmation), command, {
        controlledSeat,
        durable: isDurableNightCommand(command),
        domainRejection: 'state',
      });
      if (ok) {
        draft.clear();
        setSwapSecond(null);
      }
      return ok;
    },
    [controlledSeat, draft, model, roleRevealRandomNonce, stepId, submit],
  );

  /** A dialog callback that submits one confirmation. */
  const confirmWith = useCallback(
    (confirmation: NightConfirmation) => (): Promise<void> =>
      dispatch(confirmation).then(() => undefined),
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
    if (rejection.rejectionId === lastRejectionIdRef.current) return;
    lastRejectionIdRef.current = rejection.rejectionId;
    roomScreenLog.warn('Night action rejected', rejection);
    showDismissAlert(`${NIGHT_ACTION_LABEL}失败`, rejection.reason);
  }, [viewModel.night.rejection]);

  // ── The step prompt / reveal dialog, once per step scope ──
  const promptedKeyRef = useRef<string | null>(null);
  const promptKey = (() => {
    if (input.isAudioResumeDue) return null;
    switch (model.kind) {
      case 'idle':
      case 'blocked':
      case 'ackHunterStatus':
        return null;
      case 'pickTwoSeats':
        return model.pick.first === null ? 'prompt' : null;
      default:
        return model.kind;
    }
  })();
  const scopeKey = `${state.status}|${stepId ?? ''}|${effectiveSeat ?? ''}|${roleRevealRandomNonce ?? ''}`;
  useEffect(() => {
    if (promptKey === null) return;
    const key = `${scopeKey}|${promptKey}`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    switch (model.kind) {
      case 'ackReveal':
        showDismissAlert(model.title, model.reveal.result, confirmWith({ kind: 'ack' }));
        return;
      case 'ackGroupReveal':
        showDismissAlert(model.prompt.title, model.prompt.text);
        return;
      case 'pickSeat':
      case 'wolfVote':
      case 'pickTwoSeats':
      case 'multiSelect':
      case 'witch':
      case 'confirmStatus':
      case 'chooseCard':
      case 'skipOnly':
        showDismissAlert(model.prompt.title, model.prompt.text);
        return;
      case 'idle':
      case 'blocked':
      case 'ackHunterStatus':
        return;
    }
  }, [confirmWith, model, promptKey, scopeKey]);

  // ── Seat taps ──
  const blockedToastAtRef = useRef(0);
  const onSeatTap = useCallback(
    (seat: number): boolean => {
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
          if (!model.selectable.includes(seat)) return false;
          showConfirmAlert(
            model.confirmTitle,
            model.confirmText,
            confirmWith({ kind: 'seat', seat }),
          );
          return true;
        case 'wolfVote': {
          if (!model.selectable.includes(seat)) return false;
          const text = model.voteConfirmTemplate.replace('{seat}', formatSeat(seat));
          showConfirmAlert(
            model.confirmTitle,
            model.immuneSeats.includes(seat) ? `${text}\n${WOLF_IMMUNE_NOTE}` : text,
            confirmWith({ kind: 'seat', seat }),
          );
          return true;
        }
        case 'pickTwoSeats': {
          if (!model.selectable.includes(seat)) return false;
          const first = model.pick.first;
          if (first === null) {
            draft.updateDraft((current) => ({ ...current, firstSwapSeat: seat }));
            showDismissAlert(
              model.firstPickTitle,
              model.firstPickTemplate.replace('{seat}', formatSeat(seat)),
            );
            return true;
          }
          if (seat === first) return true;
          if (stepId === null) throw new Error('[FAIL-FAST] Swap pick outside a night step');
          setSwapSecond({ stepId, seat });
          showConfirmAlert(
            model.confirmTitle,
            model.confirmText,
            confirmWith({ kind: 'seats', seats: [first, seat] }),
            { onCancel: () => setSwapSecond(null) },
          );
          return true;
        }
        case 'multiSelect': {
          if (!model.selectable.includes(seat)) return false;
          const isSelected = model.selected.includes(seat);
          if (!isSelected && model.selected.length >= model.max) {
            toast.info(`最多选择${model.max}人`);
            return true;
          }
          draft.updateDraft((current) => ({
            ...current,
            multiSelectedSeats: isSelected
              ? current.multiSelectedSeats.filter((picked) => picked !== seat)
              : [...current.multiSelectedSeats, seat],
          }));
          return true;
        }
        case 'witch':
          if (!model.canPoison || !model.selectable.includes(seat)) return false;
          showConfirmAlert(
            model.poisonConfirmTitle,
            model.poisonConfirmText,
            confirmWith({ kind: 'poison', seat }),
          );
          return true;
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
    [confirmWith, draft, model, stepId],
  );

  // ── Bottom buttons ──
  const [isChooseCardOpen, setIsChooseCardOpen] = useState(false);
  useEffect(() => {
    if (model.kind !== 'chooseCard') setIsChooseCardOpen(false);
  }, [model.kind]);

  const onNightButton = useCallback(
    (action: NightButtonAction): void => {
      switch (action.kind) {
        case 'skip':
          if (model.kind === 'confirmStatus') {
            // Seed wolf declining to infect: the dialog already named the choice.
            void dispatch({ kind: 'skip' });
            return;
          }
          showConfirmAlert(SKIP_CONFIRM_TITLE, SKIP_CONFIRM_TEXT, confirmWith({ kind: 'skip' }));
          return;
        case 'emptyVote':
          if (model.kind !== 'wolfVote') throw illegalButton(action, model);
          showConfirmAlert(
            model.confirmTitle,
            model.emptyVoteConfirmText,
            confirmWith({ kind: 'emptyVote' }),
          );
          return;
        case 'withdrawVote':
          if (model.kind !== 'wolfVote') throw illegalButton(action, model);
          showConfirmAlert(
            WOLF_WITHDRAW_CONFIRM_TITLE,
            WOLF_WITHDRAW_CONFIRM_TEXT,
            confirmWith({ kind: 'withdrawVote' }),
          );
          return;
        case 'save':
          if (model.kind !== 'witch') throw illegalButton(action, model);
          showConfirmAlert(
            model.saveConfirmTitle,
            model.saveConfirmText,
            confirmWith({ kind: 'save' }),
          );
          return;
        case 'openStatus': {
          if (model.kind !== 'confirmStatus') throw illegalButton(action, model);
          if (model.isUnavailable) {
            showDismissAlert(
              model.dialog.title,
              model.dialog.text,
              confirmWith({ kind: 'confirm' }),
            );
            return;
          }
          if (model.skipLabel === null) {
            showDismissAlert(
              model.dialog.title,
              model.dialog.text,
              confirmWith({ kind: 'confirm' }),
            );
            return;
          }
          // Seed wolf: decline (cancel-styled) or infect (primary); both submit.
          showAlert(model.dialog.title, model.dialog.text, [
            { text: model.skipLabel, style: 'cancel', onPress: confirmWith({ kind: 'skip' }) },
            {
              text: model.buttonLabel,
              style: 'default',
              onPress: confirmWith({ kind: 'confirm' }),
            },
          ]);
          return;
        }
        case 'openGroupReveal':
          if (model.kind !== 'ackGroupReveal') throw illegalButton(action, model);
          // The schema names the acknowledgement button (e.g. 我知道了).
          showAlert(model.text.title, model.text.text, [
            { text: model.text.confirmLabel, onPress: confirmWith({ kind: 'ack' }) },
          ]);
          return;
        case 'openHunterStatus':
          if (model.kind !== 'ackHunterStatus') throw illegalButton(action, model);
          showDismissAlert(model.dialog.title, model.dialog.text, confirmWith({ kind: 'ack' }));
          return;
        case 'openChooseCard':
          if (model.kind !== 'chooseCard') throw illegalButton(action, model);
          setIsChooseCardOpen(true);
          return;
        case 'confirmMultiSelect': {
          if (model.kind !== 'multiSelect') throw illegalButton(action, model);
          const seats = model.selected;
          showConfirmAlert(
            model.confirmText,
            `已选择：${seats.map((seat) => formatSeat(seat)).join('、')}`,
            confirmWith({ kind: 'seats', seats }),
          );
          return;
        }
      }
    },
    [confirmWith, dispatch, model],
  );

  const chooseCardModal = useMemo((): NightChooseCardModal | null => {
    if (model.kind !== 'chooseCard' || !isChooseCardOpen) return null;
    return {
      model,
      close: () => setIsChooseCardOpen(false),
      choose: async (cardIndex) => {
        const ok = await dispatch({ kind: 'card', cardIndex });
        if (ok) setIsChooseCardOpen(false);
      },
    };
  }, [dispatch, isChooseCardOpen, model]);

  return {
    model,
    actionMessage: renderActionerMessage(model, viewModel),
    onSeatTap,
    onNightButton,
    chooseCardModal,
  };
}

function illegalButton(action: NightButtonAction, model: NightInteractionModel): Error {
  return new Error(`[FAIL-FAST] Night button ${action.kind} pressed while model is ${model.kind}`);
}

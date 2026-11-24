import {
  describeWerewolfStepConfirmation,
  type GameState,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { defineCopy, renderCopy } from '@game-judge/game-engine/platform/steps';

import { formatSettleCountdown } from '@/features/room/model/formatCountdown';
import { useStepInteraction } from '@/features/room/steps/useStepInteraction';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';

import { deriveWerewolfBottomProgress } from '../werewolfRoomAdapter';

const COPY = defineCopy({
  action: '操作',
  confirmations: '{done}/{total} 已确认',
  votes: '已投 {done}/{total}',
  vote: '投票',
  settle: '结算',
  revisable: '{summary}（可改票或撤回）',
});

/** Connect the shared step controls to the current room and its authoritative command. */
export function useWerewolfNightInteraction(input: {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly userId: string;
  readonly roomId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly submit: WerewolfSubmit;
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
  readonly nowMs: number;
}) {
  const { state, viewModel, effectiveSeat } = input;
  const interaction = useStepInteraction({
    presentation: viewModel.step,
    draftIdentity: {
      userId: input.userId,
      roomId: `${input.roomId}:${state.gameSequence}:${effectiveSeat ?? 'spectator'}`,
    },
    describeConfirmation: (selection) => {
      if (effectiveSeat === null) throw new Error('[FAIL-FAST] Step confirmation without a seat');
      return describeWerewolfStepConfirmation(state, effectiveSeat, selection);
    },
    submit: (submission) =>
      input.submit(
        COPY.action,
        { type: 'werewolf.step.submit', gameSequence: state.gameSequence, submission },
        {
          controlledSeat: input.controlledSeat,
          durable: true,
          actionKey: submission.actionKey,
          transportFailure: 'toastAndRethrow',
        },
      ),
    isSuspended: input.isSuspended,
    hasPendingCommand: input.hasPendingCommand,
    progress: deriveWerewolfBottomProgress(state),
  });
  const isStepActor = viewModel.step?.isActor === true;
  const completionMessage = formatStepCompletion(input, interaction.completionProgress);
  return {
    interaction,
    isStepActor,
    actionMessage:
      [interaction.message, completionMessage].filter((part) => part !== null).join(' ') || null,
    nightStatusLine: completionMessage,
  };
}

function formatStepCompletion(
  input: { readonly viewModel: WerewolfViewModel; readonly nowMs: number },
  progress: { readonly done: number; readonly total: number } | null,
): string | null {
  const { viewModel, nowMs } = input;
  if (viewModel.step?.isActor !== true || progress === null) return null;
  if (viewModel.stepProgressKind !== 'vote') {
    return progress.total <= 1 ? null : renderCopy(COPY.confirmations, progress);
  }
  const deadlineMs = viewModel.step.deadlineMs;
  if (deadlineMs === null) return renderCopy(COPY.votes, progress);
  const remaining = Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
  return renderCopy(COPY.revisable, {
    summary: formatSettleCountdown(remaining, COPY.vote, COPY.settle),
  });
}

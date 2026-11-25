import {
  describeWerewolfStepConfirmation,
  type GameState,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { defineCopy } from '@game-judge/game-engine/platform/steps';

import { formatStepCompletion } from '@/features/room/steps/formatStepCompletion';
import { useStepInteraction } from '@/features/room/steps/useStepInteraction';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';

import { deriveWerewolfBottomProgress } from '../werewolfRoomAdapter';

const COPY = defineCopy({ action: '操作' });

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
  const completionMessage = formatStepCompletion({
    isActor: isStepActor,
    progressKind: viewModel.stepProgressKind,
    progress: interaction.completionProgress,
    deadlineMs: viewModel.step?.deadlineMs ?? null,
    nowMs: input.nowMs,
  });
  return {
    interaction,
    isStepActor,
    actionMessage:
      [interaction.message, completionMessage].filter((part) => part !== null).join(' ') || null,
    nightStatusLine: completionMessage,
  };
}

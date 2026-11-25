import {
  describeSecrethitlerStepConfirmation,
  type SecrethitlerPublicCommand,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { type StepInteraction, useStepInteraction } from '@/features/room/steps/useStepInteraction';

const NIGHT_SUBMIT_LABEL = '查看夜间信息';

/** Connects Secret Hitler's first-night reveal to the shared step controls. */
export function useSecrethitlerNightInteraction(input: {
  readonly state: SecrethitlerState;
  readonly viewModel: SecrethitlerViewModel | null;
  readonly userId: string;
  readonly roomId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly submit: ReadyRoomSession<SecrethitlerState, SecrethitlerPublicCommand>['submit'];
  readonly hasPendingCommand: boolean;
}): StepInteraction {
  const { state, effectiveSeat } = input;
  return useStepInteraction({
    presentation: input.viewModel?.step ?? null,
    draftIdentity: {
      userId: input.userId,
      roomId: `${input.roomId}:${state.gameSequence}:${effectiveSeat ?? 'spectator'}`,
    },
    describeConfirmation: (selection) => {
      if (effectiveSeat === null)
        throw new Error('[FAIL-FAST] Secret Hitler step confirmation without a seat');
      return describeSecrethitlerStepConfirmation(state, effectiveSeat, selection);
    },
    submit: (submission) =>
      input.submit(
        NIGHT_SUBMIT_LABEL,
        { type: 'secrethitler.step.submit', gameSequence: state.gameSequence, submission },
        {
          controlledSeat: input.controlledSeat,
          durable: true,
          actionKey: submission.actionKey,
          transportFailure: 'toastAndRethrow',
        },
      ),
    isSuspended: false,
    hasPendingCommand: input.hasPendingCommand,
  });
}

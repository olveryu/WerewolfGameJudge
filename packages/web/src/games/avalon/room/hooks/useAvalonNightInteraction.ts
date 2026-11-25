import {
  type AvalonPublicCommand,
  type AvalonState,
  type AvalonViewModel,
  describeAvalonStepConfirmation,
} from '@game-judge/game-engine/games/avalon/public';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { type StepInteraction, useStepInteraction } from '@/features/room/steps/useStepInteraction';

const NIGHT_SUBMIT_LABEL = '查看夜间信息';

/**
 * Connect the shared step controls to the Avalon night and its authoritative command.
 * Viewing runs alongside the night narration, so playback never suspends it.
 */
export function useAvalonNightInteraction(input: {
  readonly state: AvalonState;
  readonly viewModel: AvalonViewModel | null;
  readonly userId: string;
  readonly roomId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly submit: ReadyRoomSession<AvalonState, AvalonPublicCommand>['submit'];
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
      if (effectiveSeat === null) throw new Error('[FAIL-FAST] Step confirmation without a seat');
      return describeAvalonStepConfirmation(state, effectiveSeat, selection);
    },
    submit: (submission) =>
      input.submit(
        NIGHT_SUBMIT_LABEL,
        { type: 'avalon.step.submit', gameSequence: state.gameSequence, submission },
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

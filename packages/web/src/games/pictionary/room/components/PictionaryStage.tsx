/** Routes authoritative Pictionary phases to the task, transition, gallery, and ended surfaces. */

import './PictionaryStage.css';

import {
  createPictionaryCommand,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useState } from 'react';

import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

import {
  type PictionaryTaskInput,
  usePictionaryAutoSubmission,
} from '../hooks/usePictionaryAutoSubmission';
import { PictionaryEndedStage, PictionaryGalleryStage } from './PictionaryGalleryStage';
import { PictionaryTaskStage } from './PictionaryTaskStage';

interface PictionaryStageProps {
  readonly state: PictionaryState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  /** Remaining seconds of the phase deadline, ticked by the room hook; null when it has none. */
  readonly remainingSeconds: number | null;
  /** The settle is overdue past its grace period: the host may retry it. */
  readonly isOverdue: boolean;
  readonly session: PictionaryRoomSession;
  /** The room's single-flight submit; seat actions pass `{ controlledSeat }`. */
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
  /** Opens the shared review at one album's page. */
  readonly openReview: (pageKey: string) => void;
}

/** Remounts per round, step and user so local drafts never leak across tasks. */
export function PictionaryStage(props: PictionaryStageProps) {
  return (
    <PictionaryStageContent
      key={`${props.state.roundId}:${props.state.stepIndex}:${props.userId}`}
      {...props}
    />
  );
}

function PictionaryStageContent({
  state,
  effectiveSeat,
  controlledSeat,
  userId,
  isHost,
  remainingSeconds,
  isOverdue,
  session,
  submit,
  isSubmitting,
  openReview,
}: PictionaryStageProps) {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  const [inputs] = useState(() => new Map<number, PictionaryTaskInput>());
  const autoSubmission = usePictionaryAutoSubmission(state, userId, session, inputs);

  if (state.phase === 'gallery') {
    return (
      <div className="pictionary-stage">
        <PictionaryGalleryStage
          state={state}
          isHost={isHost}
          submit={submit}
          isSubmitting={isSubmitting}
          remainingSeconds={remainingSeconds}
          isOverdue={isOverdue}
        />
      </div>
    );
  }
  if (state.phase === 'ended' || state.phase === 'aborted') {
    return (
      <div className="pictionary-stage">
        <PictionaryEndedStage state={state} openReview={openReview} />
      </div>
    );
  }
  const retrySettle = (): void => {
    void submit(
      '重新推进',
      createPictionaryCommand(state, { type: 'pictionary.phase.retrySettle' }, null),
      { durable: true },
    );
  };
  return (
    <div className="pictionary-stage">
      <StageSettleRescue
        remainingSeconds={remainingSeconds}
        isOverdue={isOverdue}
        isHost={isHost}
        isRetrying={isSubmitting}
        onRetry={retrySettle}
        waitingLabel="等待推进…"
      />
      <PictionaryTaskStage
        inputs={inputs}
        state={state}
        effectiveSeat={effectiveSeat}
        controlledSeat={controlledSeat}
        userId={userId}
        submit={submit}
        isSubmitting={isSubmitting}
        isExpired={remainingSeconds === 0}
        autoSubmission={autoSubmission}
      />
    </div>
  );
}

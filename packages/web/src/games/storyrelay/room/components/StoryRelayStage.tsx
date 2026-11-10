/** Coordinates text tasks, collection controls and terminal stories within the shared room shell. */

import './StoryRelayStage.css';

import {
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import IconRefreshOutline from '~icons/ion/refresh-outline';

import { useStoryRelayAutoSubmission } from '../hooks/useStoryRelayAutoSubmission';
import { StoryRelayGallery } from './StoryRelayGallery';
import { StoryRelayTaskEditor } from './StoryRelayTaskEditor';

interface StoryRelayStageProps {
  readonly state: StoryRelayState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  /** Remaining seconds of the phase deadline, ticked by the room hook; null when it has none. */
  readonly remainingSeconds: number | null;
  /** The settle is overdue past its grace period: the host may retry it. */
  readonly isOverdue: boolean;
  readonly session: StoryRelayRoomSession;
  /** The room's single-flight submit; seat actions pass `{ controlledSeat }`. */
  readonly submit: ReadyRoomSession<StoryRelayState, StoryRelayCommand>['submit'];
  readonly isSubmitting: boolean;
  /** Opens the shared review at one story's page. */
  readonly openReview: (pageKey: string) => void;
}

/** Routes authoritative phases without computing game transitions on the client. */
export function StoryRelayStage(props: StoryRelayStageProps) {
  return (
    <StoryRelayStageContent
      key={`${props.state.roundId}:${props.state.stepIndex}:${props.userId}`}
      {...props}
    />
  );
}

function StoryRelayStageContent({
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
}: StoryRelayStageProps) {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Story Relay lobby must use the shared seat workspace');
  }
  const retrySettle = () => {
    void submit('重新推进', {
      type: 'storyrelay.phase.retrySettle',
      phaseRevision: state.phaseRevision,
    });
  };
  const [inputs] = useState(() => new Map<number, string>());
  const finalizer = useStoryRelayAutoSubmission(state, userId, session, inputs);
  const task = effectiveSeat === null ? null : getStoryRelayTaskForSeat(state, effectiveSeat);
  const isGallery =
    state.phase === 'gallery' || state.phase === 'ended' || state.phase === 'aborted';
  return (
    <div className="storyrelay-stage" data-testid="storyrelay-stage">
      {finalizer.status === 'failed' && (
        <div className="storyrelay-retry-row">
          <Button variant="secondary" onClick={finalizer.retry}>
            <IconRefreshOutline aria-hidden />
            重试收稿
          </Button>
        </div>
      )}
      <StageSettleRescue
        remainingSeconds={remainingSeconds}
        isOverdue={isOverdue}
        isHost={isHost}
        isRetrying={isSubmitting}
        onRetry={retrySettle}
        waitingLabel="等待推进…"
      />
      {isGallery ? (
        <StoryRelayGallery
          state={state}
          isHost={isHost}
          submit={submit}
          isSubmitting={isSubmitting}
          openReview={openReview}
          remainingSeconds={remainingSeconds}
          isOverdue={isOverdue}
          onRetrySettle={retrySettle}
        />
      ) : (
        <>
          {state.phase === 'settling' && (
            <p className="storyrelay-settling-reminder">
              等待期间请留在 App/小程序内并保持联网，以免收稿卡住
            </p>
          )}
          {task === null ? (
            <div className="storyrelay-content">
              <p className="storyrelay-text">
                {state.phase === 'transition' ? '全部收稿，等待下一阶段' : '旁观中，等待故事揭晓'}
              </p>
            </div>
          ) : (
            <StoryRelayTaskEditor
              key={`${task.roundId}:${task.stepIndex}:${task.chainId}:${task.authorSeat}`}
              state={state}
              task={task}
              inputs={inputs}
              controlledSeat={controlledSeat}
              submit={submit}
              isSubmitting={isSubmitting}
              finalization={finalizer.status}
              isExpired={remainingSeconds === 0}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Routes a live Pictionary step to the text task, drawing task, or a waiting surface. */

import {
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type { ReactNode } from 'react';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import { getPictionaryCompletedCount } from '@/games/pictionary/model/pictionarySelectors';
import { TESTIDS } from '@/testids';

import type { PictionarySubmissionStatus } from '../hooks/usePictionaryAutoSubmission';
import { PictionaryDrawingTask } from './PictionaryDrawingTask';
import { PICTIONARY_STAGE_MAX_WIDTH, type PictionaryTaskViewProps } from './PictionaryTaskLayout';
import { PictionaryTextTask } from './PictionaryTextTask';

function PictionaryWaitingStage({
  state,
  remainingSeconds,
  title,
  description,
  children,
}: {
  readonly state: PictionaryState;
  readonly remainingSeconds: number | null;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
}) {
  const completedCount = getPictionaryCompletedCount(state);
  const pendingCount = Math.max(0, state.config.numberOfPlayers - completedCount);
  const completedLabel = state.phase === 'answering' ? '人已完成编辑' : '人已送达';
  return (
    <RoomTaskFrame
      header={
        <GalleryAlbumHeading
          eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
          title={title}
          description={description}
          remainingSeconds={remainingSeconds}
        />
      }
      maxWidth={PICTIONARY_STAGE_MAX_WIDTH}
      testId={TESTIDS.pictionaryStageFrame}
      footer={null}
    >
      <div className="pictionary-waiting-body">
        <Spinner label="等待其他玩家" size="lg" />
        <p className="pictionary-waiting-count">
          {completedCount} {completedLabel}
        </p>
        <div className="pictionary-progress-track" aria-hidden>
          {completedCount > 0 && (
            <div className="pictionary-progress-done" style={{ flex: completedCount }} />
          )}
          {pendingCount > 0 && <div style={{ flex: pendingCount }} />}
        </div>
        <p className="pictionary-waiting-hint">所有人完成后会自动交换任务</p>
        {state.phase === 'settling' && (
          <p className="pictionary-waiting-hint">
            等待期间请留在 App/小程序内并保持联网，以免收稿卡住
          </p>
        )}
        {children}
      </div>
    </RoomTaskFrame>
  );
}

function getSettlingDescription(status: PictionarySubmissionStatus): string {
  switch (status) {
    case 'failed':
      return '内容发送失败，请重试。';
    case 'retrying':
      return '发送暂未成功，正在自动重试。';
    case 'waiting':
      return '你的内容已处理，正在等待其他玩家。';
    case 'idle':
    case 'submitting':
      return '正在自动提交本棒内容，请留在 App/小程序内。';
  }
}

/** One live relay step for the viewer: their task, the transition, settling, or spectating. */
export function PictionaryTaskStage({
  inputs,
  state,
  effectiveSeat,
  controlledSeat,
  userId,
  submit,
  isSubmitting,
  remainingSeconds,
  isExpired,
  autoSubmission,
}: Omit<PictionaryTaskViewProps, 'task' | 'effectiveSeat'> & {
  readonly effectiveSeat: number | null;
  readonly userId: string;
  readonly remainingSeconds: number | null;
  readonly autoSubmission: {
    readonly status: PictionarySubmissionStatus;
    readonly retry: () => void;
  };
}) {
  if (state.phase === 'transition') {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="这一棒完成"
        description="马上交换任务，请不要透露刚才看到的内容。"
      />
    );
  }
  if (state.phase === 'settling') {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在收取最终内容"
        description={getSettlingDescription(autoSubmission.status)}
      >
        {autoSubmission.status === 'failed' && (
          <Button variant="secondary" onClick={autoSubmission.retry}>
            重试发送
          </Button>
        )}
      </PictionaryWaitingStage>
    );
  }
  if (effectiveSeat === null) {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在旁观接龙"
        description="本轮开始后加入的玩家可以等待揭晓。"
      />
    );
  }
  const task = getPictionaryTaskForSeat(state, effectiveSeat);
  if (task === null) {
    throw new Error('[FAIL-FAST] Seated Pictionary player has no task');
  }
  const TaskView = task.expectedKind === 'text' ? PictionaryTextTask : PictionaryDrawingTask;
  return (
    <TaskView
      key={`${state.roundId}:${state.stepIndex}:${task.chain.id}:${userId}`}
      inputs={inputs}
      state={state}
      task={task}
      effectiveSeat={effectiveSeat}
      submit={submit}
      isSubmitting={isSubmitting}
      controlledSeat={controlledSeat}
      isExpired={isExpired}
    />
  );
}

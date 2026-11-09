/** Routes authoritative Pictionary phases to the task, transition, gallery, and ended surfaces. */

import './PictionaryStage.css';

import {
  createPictionaryCommand,
  getPictionaryAnswerDurationSeconds,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useState } from 'react';

import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { AnsweringTopBar } from '@/features/room/components/AnsweringTopBar';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { getAnsweringTopBarSeats } from '@/features/room/model/answeringTopBarSeats';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

import {
  type PictionaryTaskInput,
  usePictionaryAutoSubmission,
} from '../hooks/usePictionaryAutoSubmission';
import { PictionaryEndedStage, PictionaryGalleryStage } from './PictionaryGalleryStage';
import { PictionaryTaskStage } from './PictionaryTaskStage';

/** Pictionary 接管：转接共用 BotTakeover 组件。 */
function PictionaryTakeover({
  seatModel,
  isHost,
  canControlBots,
  controlledSeat,
  remainingSeconds,
}: {
  readonly seatModel: RoomSeatBoardModel;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly controlledSeat: number | null;
  readonly remainingSeconds: number | null;
}) {
  const onTakeOver = seatModel.onBotSeatLongPress;
  if (onTakeOver === null) return null;
  const bots: BotTakeoverBot[] = [];
  for (let seat = 0; seat < seatModel.source.count; seat += 1) {
    const seatView = seatModel.source.getSeat(seat);
    const displayName = seatView.player?.displayName;
    if (seatView.player?.occupant.kind !== 'bot' || displayName === undefined) continue;
    bots.push({
      seat,
      displayName,
      status: 'waiting',
      statusLabel: seat === controlledSeat ? '接管中' : '待命',
      actionLabel: '接管',
    });
  }
  return (
    <BotTakeover
      bots={bots}
      // activeSeat 恒 null：每棒全体并行创作，没有单一行动座位；机器人任务由房主端自动提交兜底。
      activeSeat={null}
      remainingSeconds={remainingSeconds}
      controlledSeat={controlledSeat}
      canControl={isHost && canControlBots}
      isLobby={false}
      onTakeOver={onTakeOver}
    />
  );
}

interface PictionaryStageProps {
  readonly state: PictionaryState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly seatModel: RoomSeatBoardModel;
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
  canControlBots,
  seatModel,
  session,
  submit,
  isSubmitting,
  openReview,
}: PictionaryStageProps) {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  // 倒计时只做展示：到期推进由服务端定时结算完成，任何手机都不发 expire。
  // 房主自救是唯一的例外：截止后宽限期已过、结算仍未到达时，房主可重新推进本阶段的结算。
  const { remainingSeconds, isOverdue } = useStageDeadline({
    deadlineAt: state.deadlineAt,
    refreshIntervalMs: 250,
  });
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
      <AnsweringTopBar
        remainingSeconds={remainingSeconds}
        totalSeconds={getPictionaryAnswerDurationSeconds(state, state.stepIndex)}
        seats={getAnsweringTopBarSeats(seatModel.source)}
      />
      <PictionaryTakeover
        seatModel={seatModel}
        isHost={isHost}
        canControlBots={canControlBots}
        controlledSeat={controlledSeat}
        remainingSeconds={remainingSeconds}
      />
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
        remainingSeconds={remainingSeconds}
        isExpired={remainingSeconds === 0}
        autoSubmission={autoSubmission}
      />
    </div>
  );
}

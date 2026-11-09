/** Coordinates text tasks, collection controls and terminal stories within the shared room shell. */

import './StoryRelayStage.css';

import {
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';

import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { Button } from '@/components/Button';
import { AnsweringTopBar } from '@/features/room/components/AnsweringTopBar';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { getAnsweringTopBarSeats } from '@/features/room/model/answeringTopBarSeats';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import IconRefreshOutline from '~icons/ion/refresh-outline';

import { useStoryRelayAutoSubmission } from '../hooks/useStoryRelayAutoSubmission';
import { StoryRelayGallery } from './StoryRelayGallery';
import { StoryRelayTaskEditor } from './StoryRelayTaskEditor';

/** StoryRelay 接管：转接共用 BotTakeover 组件。 */
function StoryRelayTakeover({
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
      // activeSeat 恒 null：故事接龙每棒全体并行创作，没有单一行动座位；机器人任务由
      // 房主端自动提交兜底。传单个座位会让接管组件的紧急提醒与列表置顶误指向某一个
      // 机器人。
      activeSeat={null}
      remainingSeconds={remainingSeconds}
      controlledSeat={controlledSeat}
      canControl={isHost && canControlBots}
      isLobby={false}
      onTakeOver={onTakeOver}
    />
  );
}

interface StoryRelayStageProps {
  readonly state: StoryRelayState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly seatModel: RoomSeatBoardModel;
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
  canControlBots,
  seatModel,
  session,
  submit,
  isSubmitting,
  openReview,
}: StoryRelayStageProps) {
  // 倒计时只做展示：到期推进由服务端定时结算完成，任何手机都不发 expire。
  // 房主自救（D3 follow-up）是唯一的例外：截止后宽限期已过、结算仍未
  // 到达时，房主可通过共享自救组件重新推进本阶段的结算。
  const { remainingSeconds, isOverdue } = useStageDeadline({ deadlineAt: state.deadlineAt });
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
          <AnsweringTopBar
            remainingSeconds={remainingSeconds}
            totalSeconds={state.config.writingDurationSeconds}
            seats={getAnsweringTopBarSeats(seatModel.source)}
          />
          <StoryRelayTakeover
            seatModel={seatModel}
            isHost={isHost}
            canControlBots={canControlBots}
            controlledSeat={controlledSeat}
            remainingSeconds={remainingSeconds}
          />
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

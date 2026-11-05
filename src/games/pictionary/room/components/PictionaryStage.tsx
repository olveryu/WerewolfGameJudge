/** Route authoritative Pictionary phases to task, transition, gallery, and ended surfaces. */

import {
  createPictionaryCommand,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
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
  readonly releaseBot: () => void;
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly seatModel: RoomSeatBoardModel;
  readonly session: PictionaryRoomSession;
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
}

export const PictionaryStage: React.FC<PictionaryStageProps> = (props) => (
  <PictionaryStageContent
    key={`${props.state.roundId}:${props.state.stepIndex}:${props.userId}`}
    {...props}
  />
);

const PictionaryStageContent: React.FC<PictionaryStageProps> = ({
  state,
  effectiveSeat,
  controlledSeat,
  releaseBot,
  userId,
  isHost,
  canControlBots,
  seatModel,
  session,
  submit,
  isSubmitting,
}) => {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  // 倒计时只做展示：到期推进由服务端定时结算完成，任何手机都不发 expire。
  // 房主自救（D3 follow-up）是唯一的例外：截止后宽限期已过、结算仍未
  // 到达时，房主可通过共享自救组件重新推进本阶段的结算。
  const { remainingSeconds, isOverdue } = useStageDeadline({
    deadlineAt: state.deadlineAt,
    refreshIntervalMs: 250,
  });
  const retrySettle = useCallback(() => {
    void submit(
      '重新推进',
      createPictionaryCommand(state, { type: 'pictionary.phase.retrySettle' }, null),
      { durable: true },
    );
  }, [state, submit]);
  // pictionary 原 hook 返回 { remainingSeconds, isExpired }，此处保持调用方兼容
  const deadline = { remainingSeconds, isExpired: remainingSeconds === 0 };
  const [inputs] = useState(() => new Map<number, PictionaryTaskInput>());
  const autoSubmission = usePictionaryAutoSubmission(state, userId, session, inputs);

  if (state.phase === 'gallery') {
    return (
      <View style={styles.container}>
        <PictionaryGalleryStage
          state={state}
          isHost={isHost}
          submit={submit}
          isSubmitting={isSubmitting}
          remainingSeconds={deadline.remainingSeconds}
          isOverdue={isOverdue}
        />
      </View>
    );
  }
  if (state.phase === 'ended' || state.phase === 'aborted') {
    return (
      <View style={styles.container}>
        <PictionaryEndedStage state={state} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PictionaryTakeover
        seatModel={seatModel}
        isHost={isHost}
        canControlBots={canControlBots}
        controlledSeat={controlledSeat}
        releaseBot={releaseBot}
        remainingSeconds={deadline.remainingSeconds}
        isLobby={false}
      />
      <StageSettleRescue
        remainingSeconds={deadline.remainingSeconds}
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
        remainingSeconds={deadline.remainingSeconds}
        isExpired={deadline.isExpired}
        autoSubmission={autoSubmission}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
});

/** Pictionary 接管：转接共用 BotTakeover 组件（2026 重设计）。 */
function PictionaryTakeover({
  seatModel,
  isHost,
  canControlBots,
  controlledSeat,
  releaseBot,
  remainingSeconds,
  isLobby,
}: {
  readonly seatModel: RoomSeatBoardModel;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly remainingSeconds: number | null;
  readonly isLobby: boolean;
}) {
  const bots: BotTakeoverBot[] = useMemo(() => {
    const result: BotTakeoverBot[] = [];
    for (let seat = 0; seat < seatModel.source.count; seat += 1) {
      const seatView = seatModel.source.getSeat(seat);
      const displayName = seatView.player?.displayName;
      if (seatView.player?.occupant.kind !== 'bot' || displayName === undefined) continue;
      result.push({
        seat,
        displayName,
        status: 'waiting',
        statusLabel: seat === controlledSeat ? '接管中' : '待命',
        actionLabel: '接管',
      });
    }
    return result;
  }, [seatModel.source, controlledSeat]);

  const onTakeOver = seatModel.onBotSeatLongPress;
  if (onTakeOver === null) return null;

  return (
    <BotTakeover
      bots={bots}
      // activeSeat 恒 null：传画接龙全体并行应答，没有单一行动座位（引擎无 drawerSeat，
      // 那是 drawguess 的概念）；机器人任务由房主端自动提交兜底。传单个座位会让接管
      // 组件的紧急提醒与列表置顶误指向某一个机器人。
      activeSeat={null}
      remainingSeconds={remainingSeconds}
      controlledSeat={controlledSeat}
      canControl={isHost && canControlBots}
      isLobby={isLobby}
      onTakeOver={onTakeOver}
      onRelease={releaseBot}
    />
  );
}

/** Route authoritative Pictionary phases to task, transition, gallery, and ended surfaces. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { roomScreenLog } from '@/utils/logger';

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
}) => {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  const canExpire = isHost || effectiveSeat !== null;
  const shouldExpire = useCallback(() => canExpire, [canExpire]);
  const onExpire = useCallback(async () => {
    const result = await session.dispatch(
      { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
      { controlledSeat: null, label: '推进接龙阶段', isRecoverable: true },
    );
    if (!isSuccessfulRoomCommand(result)) {
      roomScreenLog.warn('Pictionary phase expiry was not accepted', {
        phaseRevision: state.phaseRevision,
        outcomeKind: result.kind,
      });
    }
  }, [session, state.phaseRevision]);
  const remainingSeconds = useStageDeadline({
    deadlineAt: state.deadlineAt,
    shouldExpire,
    onExpire,
    label: '推进接龙阶段',
    refreshIntervalMs: 250,
  });
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
          session={session}
          remainingSeconds={deadline.remainingSeconds}
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
      <PictionaryTaskStage
        inputs={inputs}
        state={state}
        effectiveSeat={effectiveSeat}
        controlledSeat={controlledSeat}
        userId={userId}
        session={session}
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
      if (seatView.player?.kind !== 'bot' || displayName === undefined) continue;
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

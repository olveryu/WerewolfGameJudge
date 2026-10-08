/** Coordinates text tasks, collection controls and terminal stories within the shared room shell. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { Button } from '@/components/Button';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { colors, componentSizes } from '@/theme';

import { useStoryRelayAutoSubmission } from '../hooks/useStoryRelayAutoSubmission';
import { useStoryRelayDeadline } from '../hooks/useStoryRelayDeadline';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { StoryRelayGallery } from './StoryRelayGallery';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';
import { StoryRelayTaskEditor } from './StoryRelayTaskEditor';

/** Shows public progress without revealing story assignments. */
function StoryRelayProgress({
  state,
  seatModel,
}: {
  readonly state: StoryRelayState;
  readonly seatModel: RoomSeatBoardModel;
}) {
  return (
    <View>
      <FlatList
        horizontal
        data={state.participants}
        keyExtractor={(participant) => String(participant.seat)}
        contentContainerStyle={styles.progressList}
        renderItem={({ item }) => {
          const seat = seatModel.source.getSeat(item.seat);
          return (
            <View style={styles.progressItem}>
              <Text style={styles.muted}>{item.displayName}</Text>
              <Text style={styles.muted}>{seat.statusBadge?.label ?? '已收稿'}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

/** StoryRelay 接管：转接共用 BotTakeover 组件。 */
function StoryRelayTakeover({
  seatModel,
  isHost,
  canControlBots,
  controlledSeat,
  releaseBot,
  remainingSeconds,
}: {
  readonly seatModel: RoomSeatBoardModel;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly remainingSeconds: number | null;
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
      isLobby={false}
      onTakeOver={onTakeOver}
      onRelease={releaseBot}
    />
  );
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

interface StoryRelayStageProps {
  readonly state: StoryRelayState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly seatModel: RoomSeatBoardModel;
  readonly session: StoryRelayRoomSession;
}

function StoryRelayStageContent({
  state,
  effectiveSeat,
  controlledSeat,
  releaseBot,
  userId,
  isHost,
  canControlBots,
  seatModel,
  session,
}: StoryRelayStageProps) {
  const remainingSeconds = useStoryRelayDeadline(state.deadlineAt, state.phaseRevision, session);
  const [inputs] = useState(() => new Map<number, string>());
  const finalizer = useStoryRelayAutoSubmission(state, userId, session, inputs);
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const submit = (label: string, command: StoryRelayCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: null, label }));
  const task = effectiveSeat === null ? null : getStoryRelayTaskForSeat(state, effectiveSeat);
  const isGallery =
    state.phase === 'gallery' || state.phase === 'ended' || state.phase === 'aborted';
  return (
    <View style={styles.container} testID="storyrelay-stage">
      {(remainingSeconds !== null || finalizer.status === 'failed') && (
        <View style={[styles.controls, styles.row]}>
          {remainingSeconds !== null && (
            <Text style={styles.muted}>剩余 {remainingSeconds} 秒</Text>
          )}
          {finalizer.status === 'failed' && (
            <Button
              variant="secondary"
              onPress={finalizer.retry}
              icon={
                <Ionicons
                  name="refresh-outline"
                  size={componentSizes.icon.sm}
                  color={colors.text}
                />
              }
            >
              重试收稿
            </Button>
          )}
        </View>
      )}
      {isGallery ? (
        <StoryRelayGallery
          state={state}
          isHost={isHost}
          submit={submit}
          isSubmitting={submission.isSubmitting}
        />
      ) : (
        <>
          <StoryRelayProgress state={state} seatModel={seatModel} />
          <StoryRelayTakeover
            seatModel={seatModel}
            isHost={isHost}
            canControlBots={canControlBots}
            controlledSeat={controlledSeat}
            releaseBot={releaseBot}
            remainingSeconds={remainingSeconds}
          />
          {state.phase === 'settling' && (
            <Text style={styles.settlingReminder}>
              等待期间请留在 App/小程序内并保持联网，以免收稿卡住
            </Text>
          )}
          {task === null ? (
            <View style={styles.content}>
              <Text style={styles.text}>
                {state.phase === 'transition' ? '全部收稿，等待下一阶段' : '旁观中，等待故事揭晓'}
              </Text>
            </View>
          ) : (
            <StoryRelayTaskEditor
              key={`${task.roundId}:${task.stepIndex}:${task.chainId}:${task.authorSeat}`}
              state={state}
              task={task}
              inputs={inputs}
              controlledSeat={controlledSeat}
              session={session}
              finalization={finalizer.status}
              isExpired={remainingSeconds === 0}
            />
          )}
        </>
      )}
    </View>
  );
}

/** Coordinates text tasks, collection controls and terminal stories within the shared room shell. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { colors, componentSizes } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { useStoryRelayDeadline } from '../hooks/useStoryRelayDeadline';
import { useStoryRelayDraftFinalizer } from '../hooks/useStoryRelayDraftFinalizer';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { StoryRelayGallery } from './StoryRelayGallery';
import { StoryRelayRetainedDrafts } from './StoryRelayRetainedDrafts';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';
import { StoryRelayTaskEditor } from './StoryRelayTaskEditor';

/** Host actions carry current task identity or phase revision and always confirm destructive choices. */
function StoryRelayHostActions({
  state,
  submit,
  isSubmitting,
}: {
  readonly state: StoryRelayState;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  readonly isSubmitting: boolean;
}) {
  const confirm = (title: string, message: string, command: StoryRelayCommand) =>
    showConfirmAlert(title, message, async () => {
      await submit(title, command);
    });
  const isTerminal = state.phase === 'ended' || state.phase === 'aborted';
  return (
    <View style={[styles.controls, styles.row]}>
      {state.phase === 'answering' && (
        <Button
          variant="secondary"
          disabled={isSubmitting}
          testID="storyrelay-finish-step"
          onPress={() =>
            confirm('结束本棒', '所有人的编辑将冻结并开始收稿。离线稿件需要等待重连或手动跳过。', {
              type: 'storyrelay.phase.finish',
              phaseRevision: state.phaseRevision,
            })
          }
        >
          结束本棒并收稿
        </Button>
      )}
      {state.phase === 'settling' && state.roundId !== null && state.botSeats.length > 0 && (
        <Button
          variant="secondary"
          disabled={isSubmitting}
          testID="storyrelay-skip-bots"
          onPress={() =>
            confirm(
              '跳过剩余机器人',
              '仅跳过本棒尚未收稿的机器人，不影响真人。已写但未送达的草稿保留在本机。',
              {
                type: 'storyrelay.bots.skip',
                roundId: state.roundId!,
                stepIndex: state.stepIndex,
                phaseRevision: state.phaseRevision,
              },
            )
          }
        >
          跳过剩余机器人
        </Button>
      )}
      {!isTerminal && state.completedAt === null && (
        <Button
          variant="danger"
          disabled={isSubmitting}
          onPress={() =>
            confirm(
              '中止本局',
              '将公开已收录的故事片段，本局不结算奖励。未送达草稿仍保留在本机。',
              { type: 'storyrelay.round.abort', phaseRevision: state.phaseRevision },
            )
          }
        >
          中止本局
        </Button>
      )}
      {state.phase === 'ended' && (
        <Button
          disabled={isSubmitting}
          testID="storyrelay-next-round"
          onPress={() =>
            confirm(
              '再来一局',
              '重新分配写作顺序并开始新一局。当前故事将被替换，请先复制需要保留的正文和草稿。',
              { type: 'storyrelay.round.next' },
            )
          }
        >
          再来一局
        </Button>
      )}
      {isTerminal && (
        <Button
          variant="secondary"
          disabled={isSubmitting}
          testID="storyrelay-return-lobby"
          onPress={() =>
            confirm('返回大厅', '保留座位和设置，清除当前故事。请先复制需要保留的正文和草稿。', {
              type: 'storyrelay.game.returnToLobby',
            })
          }
        >
          返回大厅
        </Button>
      )}
    </View>
  );
}

/** Shows public progress and explicit per-bot takeover without revealing story assignments. */
function StoryRelayProgress({
  state,
  seatModel,
  isHost,
  submit,
}: {
  readonly state: StoryRelayState;
  readonly seatModel: RoomSeatBoardModel;
  readonly isHost: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
}) {
  return (
    <View>
      <FlatList
        horizontal
        data={state.participants}
        keyExtractor={(participant) => String(participant.seat)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const seat = seatModel.source.getSeat(item.seat);
          const task = getStoryRelayTaskForSeat(state, item.seat);
          const takeOver = seatModel.onBotSeatLongPress;
          return (
            <View style={styles.entry}>
              <Button
                variant="secondary"
                disabled={item.userId !== null || takeOver === null}
                onPress={() => takeOver?.(item.seat)}
                testID={`storyrelay-bot-${item.seat}`}
                style={seat.highlight === 'controlled' ? styles.selected : undefined}
              >
                {item.displayName}
              </Button>
              <Text style={styles.muted}>{seat.statusBadge?.label ?? '已收稿'}</Text>
              {isHost && state.phase === 'settling' && task !== null && !task.isSubmitted && (
                <Button
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={`跳过${item.displayName}的稿件`}
                  onPress={() =>
                    showConfirmAlert(
                      '跳过稿件',
                      `确定跳过${item.displayName}本棒的稿件？未送达正文不会补入故事。`,
                      async () => {
                        await submit('跳过稿件', {
                          type: 'storyrelay.task.skip',
                          seat: task.authorSeat,
                          roundId: task.roundId,
                          stepIndex: task.stepIndex,
                          chainId: task.chainId,
                          phaseRevision: state.phaseRevision,
                        });
                      },
                    )
                  }
                >
                  跳过
                </Button>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

/** Routes authoritative phases without computing game transitions on the client. */
export function StoryRelayStage({
  state,
  roomId,
  effectiveSeat,
  controlledSeat,
  userId,
  isHost,
  seatModel,
  session,
}: {
  readonly state: StoryRelayState;
  readonly roomId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly seatModel: RoomSeatBoardModel;
  readonly session: StoryRelayRoomSession;
}) {
  const remainingSeconds = useStoryRelayDeadline(state.deadlineAt, state.phaseRevision, session);
  const finalizer = useStoryRelayDraftFinalizer(state, roomId, userId, session);
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const submit = (label: string, command: StoryRelayCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: null, label }));
  const task = effectiveSeat === null ? null : getStoryRelayTaskForSeat(state, effectiveSeat);
  const isGallery =
    state.phase === 'gallery' || state.phase === 'ended' || state.phase === 'aborted';
  return (
    <View style={styles.container} testID="storyrelay-stage">
      <View style={[styles.controls, styles.row]}>
        {remainingSeconds !== null && <Text style={styles.muted}>剩余 {remainingSeconds} 秒</Text>}
        <StoryRelayRetainedDrafts state={state} roomId={roomId} userId={userId} />
        {finalizer.status === 'failed' && (
          <Button
            variant="secondary"
            onPress={finalizer.retry}
            icon={
              <Ionicons name="refresh-outline" size={componentSizes.icon.sm} color={colors.text} />
            }
          >
            重试收稿
          </Button>
        )}
      </View>
      {isGallery ? (
        <StoryRelayGallery
          state={state}
          isHost={isHost}
          submit={submit}
          isSubmitting={submission.isSubmitting}
        />
      ) : (
        <>
          <StoryRelayProgress state={state} seatModel={seatModel} isHost={isHost} submit={submit} />
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
              roomId={roomId}
              userId={userId}
              controlledSeat={controlledSeat}
              session={session}
              finalization={finalizer.status}
              retry={finalizer.retry}
              isExpired={remainingSeconds === 0}
            />
          )}
        </>
      )}
      {isHost && (
        <StoryRelayHostActions
          state={state}
          submit={submit}
          isSubmitting={submission.isSubmitting}
        />
      )}
    </View>
  );
}

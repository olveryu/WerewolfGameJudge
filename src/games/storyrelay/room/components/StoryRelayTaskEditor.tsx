/** Edits one device-local manuscript; readiness sends no prose to the server. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayState,
  type StoryRelayTask,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { storyRelayDraftKey, storyRelayDrafts } from '@/games/storyrelay/services/storyRelayDrafts';
import { colors, componentSizes } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';

import type { StoryRelayFinalizationStatus } from '../hooks/useStoryRelayDraftFinalizer';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';

/** Remounts per task so switching authors cannot carry another manuscript into the editor. */
export function StoryRelayTaskEditor({
  state,
  task,
  roomId,
  userId,
  controlledSeat,
  session,
  finalization,
  retry,
  isExpired,
}: {
  readonly state: StoryRelayState;
  readonly task: StoryRelayTask;
  readonly roomId: string;
  readonly userId: string;
  readonly controlledSeat: number | null;
  readonly session: StoryRelayRoomSession;
  readonly finalization: StoryRelayFinalizationStatus;
  readonly retry: () => void;
  readonly isExpired: boolean;
}) {
  const key = storyRelayDraftKey(roomId, userId, task);
  const chain = state.chains.find((chain) => chain.id === task.chainId);
  if (chain === undefined) throw new Error('Story Relay task chain missing');
  const entry = chain.entries[task.stepIndex];
  const [text, setText] = useState(
    () => storyRelayDrafts.read(key) ?? (entry?.kind === 'text' ? entry.text : ''),
  );
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const isReady = state.readySeats.includes(task.authorSeat);
  const canCorrect =
    state.phase === 'settling' &&
    !task.isSubmitted &&
    finalization !== 'submitting' &&
    finalization !== 'retrying';
  const canEdit = (state.phase === 'answering' && !isReady && !isExpired) || canCorrect;
  const isValid = text.length <= STORY_RELAY_TEXT_MAX_LENGTH;
  const onChangeText = (value: string) => {
    storyRelayDrafts.write(key, value);
    setText(value);
  };
  const ready = () => {
    if (!isValid) {
      showErrorAlert('无法准备', '正文超过 512 字符，请缩短后再准备');
      return;
    }
    void submission.submit('更新准备状态', () =>
      session.dispatch(
        {
          type: 'storyrelay.task.ready.set',
          roundId: task.roundId,
          stepIndex: task.stepIndex,
          chainId: task.chainId,
          isReady: !isReady,
        },
        { controlledSeat, label: '更新准备状态' },
      ),
    );
  };
  const previous = task.previousEntry;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      testID="storyrelay-task"
    >
      <Text style={styles.title}>
        {controlledSeat === null ? '我的稿件' : `机器人${controlledSeat + 1}号的稿件`}
      </Text>
      {previous !== null && (
        <View style={styles.previous}>
          <Text style={styles.muted}>上一段</Text>
          <Text selectable style={styles.text} testID="storyrelay-previous-entry">
            {previous.kind === 'text' ? previous.text : '上一段留白'}
          </Text>
        </View>
      )}
      <TextInput
        testID="storyrelay-editor"
        accessibilityLabel={task.stepIndex === 0 ? '故事开头' : '故事续写'}
        multiline
        value={text}
        onChangeText={onChangeText}
        editable={canEdit}
        placeholder={task.stepIndex === 0 ? '故事从这里开始' : '写下接下来的故事'}
        placeholderTextColor={colors.textMuted}
        style={styles.editor}
      />
      <View style={styles.row}>
        <Text style={isValid ? styles.muted : styles.error}>
          {text.length} / {STORY_RELAY_TEXT_MAX_LENGTH}
        </Text>
        <Text style={styles.muted}>
          {entry?.kind === 'skipped'
            ? '房主已跳过，未送达草稿仍保留'
            : task.isSubmitted
              ? entry?.kind === 'empty'
                ? '已确认交空白'
                : '服务器已收稿'
              : state.phase === 'transition'
                ? '本棒已结束'
                : finalization === 'retrying'
                  ? '正在恢复发送，草稿已保留'
                  : finalization === 'failed'
                    ? '收稿失败，草稿已保留'
                    : '草稿保存在本机'}
        </Text>
      </View>
      {state.phase === 'answering' && (
        <Button
          disabled={isExpired || submission.isSubmitting}
          testID="storyrelay-ready"
          onPress={ready}
          icon={
            <Ionicons
              name={isReady ? 'arrow-undo-outline' : 'checkmark-outline'}
              size={componentSizes.icon.sm}
              color={colors.text}
            />
          }
        >
          {isReady ? '取消准备' : '准备好了'}
        </Button>
      )}
      {canCorrect && (
        <Button
          onPress={() => {
            if (!isValid) return showErrorAlert('收稿失败', '正文超过 512 字符，请缩短后重试');
            storyRelayDrafts.write(key, text);
            retry();
          }}
          testID="storyrelay-submit"
          icon={<Ionicons name="send-outline" size={componentSizes.icon.sm} color={colors.text} />}
        >
          {text.trim().length === 0 ? '确认交空白' : '重新提交稿件'}
        </Button>
      )}
    </ScrollView>
  );
}

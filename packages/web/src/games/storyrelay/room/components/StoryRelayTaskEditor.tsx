/** Edits current-page text; readiness sends no prose to the server. */

import {
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayCommand,
  type StoryRelayState,
  type StoryRelayTask,
} from '@game-judge/game-engine/games/storyrelay/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { showErrorAlert } from '@/utils/alertPresets';
import IconArrowUndoOutline from '~icons/ion/arrow-undo-outline';
import IconCheckmarkOutline from '~icons/ion/checkmark-outline';

import type { StoryRelayFinalizationStatus } from '../hooks/useStoryRelayAutoSubmission';

/** Width cap (px) of the Story Relay task column. */
const STORY_RELAY_CONTENT_MAX_WIDTH = 800;

function getEditorCopy(state: StoryRelayState, task: StoryRelayTask) {
  if (task.stepIndex === 0) return { label: '故事开头', placeholder: '故事从这里开始' };
  if (task.stepIndex === state.config.numberOfPlayers - 1) {
    return { label: '故事结局', placeholder: '写下故事的结局' };
  }
  return { label: '故事续写', placeholder: '写下接下来的故事' };
}

function getSubmissionStatusText(
  state: StoryRelayState,
  task: StoryRelayTask,
  entryKind: 'text' | 'empty' | undefined,
  finalization: StoryRelayFinalizationStatus,
): string {
  if (task.isSubmitted) return entryKind === 'empty' ? '已交空白' : '已收稿';
  if (state.phase === 'transition') return '本棒已结束';
  if (finalization === 'retrying') return '正在自动重试';
  if (finalization === 'failed') return '收稿失败';
  if (state.phase === 'settling') return '正在自动收稿';
  return '';
}

/** Remounts per task so switching authors cannot carry another manuscript into the editor. */
export function StoryRelayTaskEditor({
  state,
  task,
  inputs,
  controlledSeat,
  submit,
  isSubmitting,
  finalization,
  isExpired,
}: {
  readonly state: StoryRelayState;
  readonly task: StoryRelayTask;
  readonly inputs: Map<number, string>;
  readonly controlledSeat: number | null;
  readonly submit: ReadyRoomSession<StoryRelayState, StoryRelayCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly finalization: StoryRelayFinalizationStatus;
  readonly isExpired: boolean;
}) {
  const chain = state.chains.find((candidate) => candidate.id === task.chainId);
  if (chain === undefined) throw new Error('Story Relay task chain missing');
  const entry = chain.entries[task.stepIndex];
  const [text, setText] = useState(
    () => inputs.get(task.authorSeat) ?? (entry?.kind === 'text' ? entry.text : ''),
  );
  const isReady = state.readySeats.includes(task.authorSeat);
  const canEdit = state.phase === 'answering' && !isReady && !isExpired;
  const isValid = text.length <= STORY_RELAY_TEXT_MAX_LENGTH;
  const editorCopy = getEditorCopy(state, task);
  const changeText = (value: string) => {
    inputs.set(task.authorSeat, value);
    setText(value);
  };
  const toggleReady = () => {
    if (!isValid) {
      showErrorAlert('无法准备', '正文超过 512 字符，请缩短后再准备');
      return;
    }
    void submit(
      '更新准备状态',
      {
        type: 'storyrelay.task.ready.set',
        roundId: task.roundId,
        stepIndex: task.stepIndex,
        chainId: task.chainId,
        isReady: !isReady,
      },
      { controlledSeat },
    );
  };
  const previous = task.previousEntry;
  return (
    <RoomTaskFrame
      maxWidth={STORY_RELAY_CONTENT_MAX_WIDTH}
      testId="storyrelay-task"
      className="storyrelay-task-frame"
      header={
        <h2 className="storyrelay-title">
          {controlledSeat === null ? '我的稿件' : `${getBotDisplayName(controlledSeat)}的稿件`}
        </h2>
      }
      footer={
        state.phase === 'answering' ? (
          <Button
            disabled={isExpired || isSubmitting}
            data-testid="storyrelay-ready"
            onClick={toggleReady}
          >
            {isReady ? <IconArrowUndoOutline aria-hidden /> : <IconCheckmarkOutline aria-hidden />}
            {isReady ? '取消准备' : '准备好了'}
          </Button>
        ) : null
      }
    >
      {previous !== null && (
        <section className="storyrelay-previous" aria-label="上一段">
          <p className="storyrelay-muted">上一段</p>
          <div className="storyrelay-previous-scroll">
            <p className="storyrelay-text" data-testid="storyrelay-previous-entry">
              {previous.kind === 'text' ? previous.text : '上一段留白'}
            </p>
          </div>
        </section>
      )}
      <textarea
        className="storyrelay-editor"
        data-testid="storyrelay-editor"
        aria-label={editorCopy.label}
        maxLength={STORY_RELAY_TEXT_MAX_LENGTH}
        value={text}
        onChange={(event) => changeText(event.target.value)}
        readOnly={!canEdit}
        placeholder={editorCopy.placeholder}
      />
      <div className="storyrelay-row">
        <p className={isValid ? 'storyrelay-muted' : 'storyrelay-error'}>
          {text.length} / {STORY_RELAY_TEXT_MAX_LENGTH}
        </p>
        <p className="storyrelay-muted">
          {getSubmissionStatusText(state, task, entry?.kind, finalization)}
        </p>
      </div>
    </RoomTaskFrame>
  );
}

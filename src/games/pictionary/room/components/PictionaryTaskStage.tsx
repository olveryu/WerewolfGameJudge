/** Player task surfaces for Pictionary text, drawing, upload, and waiting states. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getPictionaryTaskForSeat,
  getPictionaryTextGraphemeCount,
  hasPictionaryForbiddenControlCharacter,
  isValidPictionaryText,
  PICTIONARY_TEXT_MAX_LENGTH,
  type PictionaryDrawingReservation,
  type PictionaryState,
  type PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import {
  EMPTY_PICTIONARY_DRAWING_DRAFT,
  PICTIONARY_DRAWING_PALETTE,
  PICTIONARY_DRAWING_WIDTHS,
  type PictionaryDrawingColor,
  type PictionaryDrawingDraftAction,
  type PictionaryDrawingStroke,
  type PictionaryDrawingTool,
  type PictionaryDrawingWidth,
  reducePictionaryDrawingDraft,
} from '@/games/pictionary/model/pictionaryDrawing';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import {
  getPictionarySeatDisplayName,
  getPictionarySubmittedCount,
} from '@/games/pictionary/model/pictionarySelectors';
import {
  type PictionaryDrawingDraftScope,
  pictionaryDrawingDraftStore,
} from '@/games/pictionary/services/PictionaryDrawingDraftStore';
import { uploadPictionaryDrawing } from '@/games/pictionary/services/pictionaryMediaApi';
import { renderPictionaryDrawing } from '@/games/pictionary/services/renderPictionaryDrawing';
import { borderRadius, colors, fixed, spacing, textStyles, typography } from '@/theme';
import { showDestructiveAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { usePictionaryRemainingSeconds } from '../hooks/usePictionaryStageDeadline';
import { PictionaryDrawingCanvas } from './PictionaryDrawingCanvas';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PictionaryStageFrame } from './PictionaryStageFrame';

interface PictionaryTaskStageProps {
  readonly state: PictionaryState;
  readonly mySeat: number | null;
  readonly userId: string;
  readonly session: PictionaryRoomSession;
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
}

interface TaskViewProps {
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
  readonly session: PictionaryRoomSession;
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
}

interface DrawingTaskProps extends TaskViewProps {
  readonly mySeat: number;
  readonly userId: string;
  readonly reservation: PictionaryDrawingReservation | null;
}

type DrawingUploadState = 'idle' | 'rendering' | 'uploading' | 'failed' | 'uploaded';

function getTextValidationMessage(text: string): string | null {
  const graphemeCount = getPictionaryTextGraphemeCount(text);
  if (graphemeCount === 0) return '请输入一个词语或短句';
  if (hasPictionaryForbiddenControlCharacter(text)) return '内容不能包含换行或控制字符';
  if (text.trim() !== text) return '开头和结尾不能有空格';
  if (graphemeCount > PICTIONARY_TEXT_MAX_LENGTH) {
    return `最多输入 ${PICTIONARY_TEXT_MAX_LENGTH} 个字`;
  }
  return null;
}

const PreviousDrawing: React.FC<{
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
}> = ({ state, task }) => {
  const previousEntry = task.previousEntry;
  if (previousEntry === null) {
    throw new Error('[FAIL-FAST] Pictionary text task requires a previous entry');
  }
  if (previousEntry.kind === 'missed') {
    return (
      <View style={styles.missedContext}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.warning} />
        <Text style={styles.missedContextText}>上一棒未完成，请根据直觉继续接龙</Text>
      </View>
    );
  }
  if (previousEntry.kind !== 'drawing') {
    throw new Error('[FAIL-FAST] Pictionary text task requires a drawing context');
  }
  return (
    <View style={styles.contextBlock}>
      <Text style={styles.contextLabel}>
        {getPictionarySeatDisplayName(state, previousEntry.authorSeat)} 的画作
      </Text>
      <PictionaryDrawingImage
        roomCode={state.roomCode}
        entryId={previousEntry.id}
        accessibilityLabel="上一棒画作"
      />
    </View>
  );
};

const PictionaryTextTask: React.FC<TaskViewProps> = ({
  state,
  task,
  session,
  remainingSeconds,
  isExpired,
}) => {
  const [text, setText] = useState('');
  const command = usePictionaryStageCommand(session);
  const validationMessage = getTextValidationMessage(text);
  const graphemeCount = getPictionaryTextGraphemeCount(text);

  const submitText = async (): Promise<void> => {
    if (!isValidPictionaryText(text)) return;
    await command.submit('提交文字', { type: 'pictionary.text.submit', text });
  };

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${state.config.numberOfPlayers} 棒`}
      title="猜猜画的是什么"
      description="只根据画面作答，不要向作者确认。"
      remainingSeconds={remainingSeconds}
    >
      <PreviousDrawing state={state} task={task} />
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!command.isSubmitting && !isExpired}
          multiline
          autoFocus
          placeholder="写下你的猜测"
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
          accessibilityLabel="看图猜词答案"
        />
        <View style={styles.composerMeta}>
          <Text
            style={[
              styles.validationText,
              validationMessage !== null && text.length > 0 && styles.invalidText,
            ]}
          >
            {text.length > 0 && validationMessage !== null
              ? validationMessage
              : '内容提交后不可修改'}
          </Text>
          <Text
            style={[
              styles.countText,
              graphemeCount > PICTIONARY_TEXT_MAX_LENGTH && styles.invalidText,
            ]}
          >
            {graphemeCount}/{PICTIONARY_TEXT_MAX_LENGTH}
          </Text>
        </View>
      </View>
      <Button
        onPress={() => void submitText()}
        disabled={validationMessage !== null || isExpired}
        loading={command.isSubmitting}
        size="lg"
        accessibilityLabel="提交文字"
      >
        提交文字
      </Button>
    </PictionaryStageFrame>
  );
};

interface ToolButtonProps {
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon, isSelected, disabled, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: isSelected, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.toolButton,
      isSelected && styles.selectedToolButton,
      disabled && styles.disabled,
      pressed && styles.pressed,
    ]}
  >
    <Ionicons
      name={icon}
      size={18}
      color={isSelected ? colors.textInverse : colors.textSecondary}
    />
    <Text style={[styles.toolButtonText, isSelected && styles.selectedToolButtonText]}>
      {label}
    </Text>
  </Pressable>
);

interface IconActionProps {
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly disabled: boolean;
  readonly onPress: () => void;
}

const IconAction: React.FC<IconActionProps> = ({ label, icon, disabled, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.iconAction,
      disabled && styles.disabled,
      pressed && styles.pressed,
    ]}
  >
    <Ionicons name={icon} size={22} color={colors.textSecondary} />
  </Pressable>
);

interface DrawingToolbarProps {
  readonly tool: PictionaryDrawingTool;
  readonly color: PictionaryDrawingColor;
  readonly strokeWidth: PictionaryDrawingWidth;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly disabled: boolean;
  readonly onToolChange: (tool: PictionaryDrawingTool) => void;
  readonly onColorChange: (color: PictionaryDrawingColor) => void;
  readonly onWidthChange: (width: PictionaryDrawingWidth) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onClear: () => void;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  tool,
  color,
  strokeWidth,
  canUndo,
  canRedo,
  disabled,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  onClear,
}) => (
  <View style={styles.toolbar}>
    <View style={styles.toolRow}>
      <View style={styles.segmentedControl}>
        <ToolButton
          label="画笔"
          icon="brush-outline"
          isSelected={tool === 'brush'}
          disabled={disabled}
          onPress={() => onToolChange('brush')}
        />
        <ToolButton
          label="橡皮"
          icon="remove-outline"
          isSelected={tool === 'eraser'}
          disabled={disabled}
          onPress={() => onToolChange('eraser')}
        />
      </View>
      <View style={styles.historyActions}>
        <IconAction
          label="撤销"
          icon="arrow-undo-outline"
          disabled={disabled || !canUndo}
          onPress={onUndo}
        />
        <IconAction
          label="重做"
          icon="arrow-redo-outline"
          disabled={disabled || !canRedo}
          onPress={onRedo}
        />
        <IconAction
          label="清空画布"
          icon="trash-outline"
          disabled={disabled || !canUndo}
          onPress={onClear}
        />
      </View>
    </View>
    <View style={styles.optionRow} accessibilityLabel="画笔颜色">
      {PICTIONARY_DRAWING_PALETTE.map((swatch) => (
        <Pressable
          key={swatch.value}
          accessibilityRole="button"
          accessibilityLabel={swatch.name}
          accessibilityState={{ selected: color === swatch.value, disabled }}
          disabled={disabled}
          onPress={() => onColorChange(swatch.value)}
          style={[
            styles.swatchButton,
            color === swatch.value && styles.selectedSwatchButton,
            disabled && styles.disabled,
          ]}
        >
          <View style={[styles.swatch, { backgroundColor: swatch.value }]} />
        </Pressable>
      ))}
    </View>
    <View style={styles.optionRow} accessibilityLabel="画笔粗细">
      {PICTIONARY_DRAWING_WIDTHS.map((width) => (
        <Pressable
          key={width}
          accessibilityRole="button"
          accessibilityLabel={`${width} 像素画笔`}
          accessibilityState={{ selected: strokeWidth === width, disabled }}
          disabled={disabled}
          onPress={() => onWidthChange(width)}
          style={[
            styles.widthButton,
            strokeWidth === width && styles.selectedWidthButton,
            disabled && styles.disabled,
          ]}
        >
          <View
            style={[
              styles.widthPreview,
              {
                width: Math.max(5, width / 2),
                height: Math.max(5, width / 2),
                backgroundColor: tool === 'eraser' ? colors.textMuted : color,
              },
            ]}
          />
        </Pressable>
      ))}
    </View>
  </View>
);

function findReservation(
  state: PictionaryState,
  mySeat: number,
): PictionaryDrawingReservation | null {
  return state.reservations.find((item) => item.authorSeat === mySeat) ?? null;
}

const PictionaryDrawingTask: React.FC<DrawingTaskProps> = ({
  state,
  task,
  mySeat,
  userId,
  reservation,
  session,
  remainingSeconds,
  isExpired,
}) => {
  const roundId = state.roundId;
  if (roundId === null) {
    throw new Error('[FAIL-FAST] Pictionary drawing task requires an active round');
  }
  const draftScope = useMemo(
    (): PictionaryDrawingDraftScope => ({
      roomCode: state.roomCode,
      roundId,
      taskId: `${task.chain.id}:${state.stepIndex}`,
      userId,
    }),
    [roundId, state.roomCode, state.stepIndex, task.chain.id, userId],
  );
  const [draft, setDraft] = useState(
    () => pictionaryDrawingDraftStore.read(draftScope) ?? EMPTY_PICTIONARY_DRAWING_DRAFT,
  );
  const [tool, setTool] = useState<PictionaryDrawingTool>('brush');
  const [color, setColor] = useState<PictionaryDrawingColor>(PICTIONARY_DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<PictionaryDrawingWidth>(14);
  const [uploadState, setUploadState] = useState<DrawingUploadState>('idle');
  const reservedSubmissionId = useRef<string | null>(reservation?.submissionId ?? null);
  const [reservedUploadDeadlineAt, setReservedUploadDeadlineAt] = useState<number | null>(
    reservation?.uploadDeadlineAt ?? null,
  );
  const uploadAbortController = useRef<AbortController | null>(null);
  const command = usePictionaryStageCommand(session);
  const uploadRemainingSeconds = usePictionaryRemainingSeconds(
    reservation?.uploadDeadlineAt ?? reservedUploadDeadlineAt,
  );

  useEffect(
    () => () => {
      uploadAbortController.current?.abort();
    },
    [],
  );

  const updateDraft = useCallback(
    (action: PictionaryDrawingDraftAction): void => {
      setDraft((current) => {
        const next = reducePictionaryDrawingDraft(current, action);
        pictionaryDrawingDraftStore.write(draftScope, next);
        return next;
      });
    },
    [draftScope],
  );

  const addStroke = useCallback(
    (stroke: PictionaryDrawingStroke) => updateDraft({ type: 'stroke.add', stroke }),
    [updateDraft],
  );

  const clearDrawing = (): void => {
    showDestructiveAlert('清空画布？', '所有笔画都会被删除。', '清空', () =>
      updateDraft({ type: 'drawing.clear' }),
    );
  };

  const submitDrawing = async (): Promise<void> => {
    setUploadState('rendering');
    try {
      const png = renderPictionaryDrawing(draft.strokes);
      let submissionId = reservation?.submissionId ?? reservedSubmissionId.current;
      if (submissionId === null) {
        const reserveResult = await command.submit('预留画作上传', {
          type: 'pictionary.drawing.reserve',
        });
        if (reserveResult === null) {
          setUploadState('idle');
          return;
        }
        const nextReservation = findReservation(reserveResult.decision.snapshot.state, mySeat);
        if (nextReservation === null) {
          throw new Error('[FAIL-FAST] Successful drawing reservation is missing from snapshot');
        }
        submissionId = nextReservation.submissionId;
        reservedSubmissionId.current = submissionId;
        setReservedUploadDeadlineAt(nextReservation.uploadDeadlineAt);
      }

      setUploadState('uploading');
      const controller = new AbortController();
      uploadAbortController.current = controller;
      const uploadResult = await uploadPictionaryDrawing(
        state.roomCode,
        submissionId,
        png,
        controller.signal,
      );
      if (uploadResult.kind !== 'committed' || uploadResult.outcome.kind !== 'success') {
        throw new Error('服务器未接受这幅画作');
      }
      pictionaryDrawingDraftStore.clear(draftScope);
      setUploadState('uploaded');
    } catch (error: unknown) {
      setUploadState('failed');
      handleError(error, {
        label: '提交画作',
        logger: roomScreenLog,
        expectedCodes: [401, 403, 409, 413, 429],
        alertMessage: '画作未能提交，请在上传时间内重试。',
      });
    } finally {
      uploadAbortController.current = null;
    }
  };

  const previousEntry = task.previousEntry;
  const isOpeningDrawing = state.stepIndex === 0;
  if (isOpeningDrawing && previousEntry !== null) {
    throw new Error('[FAIL-FAST] Opening Pictionary drawing cannot have previous context');
  }
  if (!isOpeningDrawing && (previousEntry === null || previousEntry.kind === 'drawing')) {
    throw new Error('[FAIL-FAST] Pictionary drawing task requires a text or missed context');
  }
  const isLocked = reservation !== null || reservedSubmissionId.current !== null;
  const isUploadExpired = isLocked && uploadRemainingSeconds === 0;
  const isBusy = command.isSubmitting || uploadState === 'rendering' || uploadState === 'uploading';
  const canEdit = !isLocked && !isBusy && !isExpired;
  const canSubmit =
    draft.strokes.length > 0 && !isBusy && (isLocked ? !isUploadExpired : !isExpired);

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${state.config.numberOfPlayers} 棒`}
      title={isOpeningDrawing ? '自由画一幅画' : '把这句话画出来'}
      description={
        isOpeningDrawing
          ? '不用根据题目，想到什么就画什么。画面会传给下一位玩家。'
          : '画面会传给下一位玩家，不能添加文字提示。'
      }
      remainingSeconds={isLocked ? uploadRemainingSeconds : remainingSeconds}
    >
      {!isOpeningDrawing && previousEntry !== null && previousEntry.kind !== 'drawing' && (
        <View style={styles.promptStrip}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          <View style={styles.promptCopy}>
            <Text style={styles.contextLabel}>上一棒</Text>
            <Text style={styles.promptText}>
              {previousEntry.kind === 'text' ? previousEntry.text : '上一棒未完成，请自由发挥'}
            </Text>
          </View>
        </View>
      )}
      <DrawingToolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        canUndo={draft.strokes.length > 0}
        canRedo={draft.redoStrokes.length > 0}
        disabled={!canEdit}
        onToolChange={setTool}
        onColorChange={setColor}
        onWidthChange={setStrokeWidth}
        onUndo={() => updateDraft({ type: 'stroke.undo' })}
        onRedo={() => updateDraft({ type: 'stroke.redo' })}
        onClear={clearDrawing}
      />
      <PictionaryDrawingCanvas
        strokes={draft.strokes}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        isEnabled={canEdit}
        onStrokeComplete={addStroke}
      />
      {isLocked && uploadState !== 'uploaded' && (
        <View style={styles.uploadNotice}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.info} />
          <Text style={styles.uploadNoticeText}>
            {draft.strokes.length === 0
              ? '本机没有可恢复的画稿，本棒会在宽限期后结束'
              : isUploadExpired
                ? '上传宽限期已结束'
                : '画稿已锁定，只会重试同一份内容'}
          </Text>
        </View>
      )}
      <Button
        onPress={() => void submitDrawing()}
        disabled={!canSubmit || uploadState === 'uploaded'}
        loading={isBusy}
        size="lg"
        accessibilityLabel={isLocked ? '重试上传画作' : '提交画作'}
      >
        {uploadState === 'uploaded'
          ? '已上传，正在同步'
          : isUploadExpired
            ? '上传已结束'
            : uploadState === 'failed' || isLocked
              ? '重试上传'
              : '提交画作'}
      </Button>
    </PictionaryStageFrame>
  );
};

interface WaitingStageProps {
  readonly state: PictionaryState;
  readonly remainingSeconds: number | null;
  readonly title: string;
  readonly description: string;
}

const PictionaryWaitingStage: React.FC<WaitingStageProps> = ({
  state,
  remainingSeconds,
  title,
  description,
}) => {
  const submittedCount = getPictionarySubmittedCount(state);
  const pendingCount = Math.max(0, state.config.numberOfPlayers - submittedCount);
  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${state.config.numberOfPlayers} 棒`}
      title={title}
      description={description}
      remainingSeconds={remainingSeconds}
    >
      <View style={styles.waitingBody}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.waitingCount}>{submittedCount} 人已完成</Text>
        <View style={styles.progressTrack}>
          {submittedCount > 0 && <View style={[styles.progressDone, { flex: submittedCount }]} />}
          {pendingCount > 0 && <View style={{ flex: pendingCount }} />}
        </View>
        <Text style={styles.waitingHint}>所有人完成后会自动交换任务</Text>
      </View>
    </PictionaryStageFrame>
  );
};

export const PictionaryTaskStage: React.FC<PictionaryTaskStageProps> = ({
  state,
  mySeat,
  userId,
  session,
  remainingSeconds,
  isExpired,
}) => {
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
  if (mySeat === null) {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在旁观接龙"
        description="本轮开始后加入的玩家可以等待揭晓。"
      />
    );
  }
  const task = getPictionaryTaskForSeat(state, mySeat);
  if (task === null) {
    throw new Error('[FAIL-FAST] Seated Pictionary player has no task');
  }
  const isSubmitted = task.chain.entries.length > state.stepIndex;
  const reservation = findReservation(state, mySeat);

  if (
    state.phase === 'settling' &&
    task.expectedKind === 'drawing' &&
    reservation !== null &&
    !isSubmitted
  ) {
    return (
      <PictionaryDrawingTask
        state={state}
        task={task}
        mySeat={mySeat}
        userId={userId}
        reservation={reservation}
        session={session}
        remainingSeconds={remainingSeconds}
        isExpired={isExpired}
      />
    );
  }
  if (state.phase === 'settling') {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在接收画作"
        description="已预留的画作还有一点时间完成上传。"
      />
    );
  }
  if (isSubmitted) {
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="这一棒已交卷"
        description="正在等待其他玩家完成。"
      />
    );
  }
  return task.expectedKind === 'text' ? (
    <PictionaryTextTask
      state={state}
      task={task}
      session={session}
      remainingSeconds={remainingSeconds}
      isExpired={isExpired}
    />
  ) : (
    <PictionaryDrawingTask
      state={state}
      task={task}
      mySeat={mySeat}
      userId={userId}
      reservation={reservation}
      session={session}
      remainingSeconds={remainingSeconds}
      isExpired={isExpired}
    />
  );
};

const styles = StyleSheet.create({
  contextBlock: { gap: spacing.small },
  contextLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  missedContext: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  missedContextText: { ...textStyles.bodyMedium, color: colors.text },
  composer: {
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  textInput: {
    minHeight: 132,
    padding: spacing.medium,
    ...textStyles.subtitle,
    color: colors.text,
    textAlignVertical: 'top',
  },
  composerMeta: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingHorizontal: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
  },
  validationText: { ...textStyles.caption, flex: 1, color: colors.textMuted },
  countText: { ...textStyles.caption, color: colors.textMuted },
  invalidText: { color: colors.error },
  promptStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.medium,
    borderLeftWidth: fixed.borderWidthHighlight,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  promptCopy: { flex: 1, minWidth: 0 },
  promptText: { ...textStyles.titleBold, color: colors.text, marginTop: spacing.tight },
  toolbar: {
    gap: spacing.small,
    paddingVertical: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderBottomWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  toolButton: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
  },
  selectedToolButton: { backgroundColor: colors.primary },
  toolButtonText: { ...textStyles.secondarySemibold, color: colors.textSecondary },
  selectedToolButtonText: { color: colors.textInverse },
  historyActions: { flexDirection: 'row', gap: spacing.tight },
  iconAction: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.tight },
  swatchButton: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.transparent,
  },
  selectedSwatchButton: { borderColor: colors.primary },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  widthButton: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  selectedWidthButton: { borderColor: colors.primary, borderWidth: fixed.borderWidthThick },
  widthPreview: { borderRadius: borderRadius.full },
  uploadNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  uploadNoticeText: { ...textStyles.secondary, flex: 1, color: colors.info },
  waitingBody: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
  },
  waitingCount: { ...textStyles.titleBold, color: colors.text },
  waitingHint: { ...textStyles.secondary, color: colors.textSecondary, textAlign: 'center' },
  progressTrack: {
    width: '100%',
    maxWidth: 420,
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  progressDone: { backgroundColor: colors.success },
  disabled: { opacity: fixed.disabledOpacity },
  pressed: { opacity: fixed.activeOpacity },
});

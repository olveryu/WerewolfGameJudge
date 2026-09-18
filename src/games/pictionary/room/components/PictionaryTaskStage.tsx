/** Player task surfaces for Pictionary text, drawing, upload, and waiting states. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  getPictionaryTextGraphemeCount,
  isValidPictionaryText,
  PICTIONARY_TEXT_MAX_LENGTH,
  type PictionaryState,
  type PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import {
  EMPTY_PICTIONARY_DRAWING_DRAFT,
  PICTIONARY_DRAWING_PALETTE,
  PICTIONARY_DRAWING_WIDTHS,
  type PictionaryDrawingColor,
  type PictionaryDrawingDraftAction,
  type PictionaryDrawingElement,
  type PictionaryDrawingPoint,
  type PictionaryDrawingTool,
  type PictionaryDrawingWidth,
  reducePictionaryDrawingDraft,
} from '@/games/pictionary/model/pictionaryDrawing';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionaryCompletedCount } from '@/games/pictionary/model/pictionarySelectors';
import { pictionaryDrawingDraftStore } from '@/games/pictionary/services/PictionaryDrawingDraftStore';
import {
  createPictionaryTaskDraftScope,
  type PictionaryTaskDraftScope,
} from '@/games/pictionary/services/pictionaryTaskDraftScope';
import {
  PICTIONARY_TEXT_DRAFT_MAX_CODE_UNITS,
  pictionaryTextDraftStore,
} from '@/games/pictionary/services/PictionaryTextDraftStore';
import { createPictionaryFillElement } from '@/games/pictionary/services/renderPictionaryDrawing';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, textStyles, typography } from '@/theme';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { PictionaryDraftFinalizationStatus } from '../hooks/usePictionaryDraftFinalizer';
import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { PictionaryDrawingCanvas } from './PictionaryDrawingCanvas';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PictionaryStageFrame } from './PictionaryStageFrame';

interface PictionaryTaskStageProps {
  readonly state: PictionaryState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly session: PictionaryRoomSession;
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
  readonly draftFinalizer: {
    readonly status: PictionaryDraftFinalizationStatus;
    readonly retry: () => void;
    readonly submitEmpty: () => void;
  };
}

interface TaskViewProps {
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
  readonly effectiveSeat: number;
  readonly userId: string;
  readonly session: PictionaryRoomSession;
  readonly controlledSeat: number | null;
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
}

function getTextValidationMessage(text: string): string | null {
  const graphemeCount = getPictionaryTextGraphemeCount(text);
  if (graphemeCount === 0) return '请输入一个词语或短句';
  if (text.length > PICTIONARY_TEXT_MAX_LENGTH) {
    return `最多输入 ${PICTIONARY_TEXT_MAX_LENGTH} 个字符`;
  }
  return null;
}

const PreviousDrawing: React.FC<{
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
  readonly controlledSeat: number | null;
}> = ({ state, task, controlledSeat }) => {
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
      <Text style={styles.contextLabel}>上一棒画作</Text>
      <PictionaryDrawingImage
        roomCode={state.roomCode}
        entryId={previousEntry.id}
        accessibilityLabel="上一棒画作"
        controlledSeat={controlledSeat}
      />
    </View>
  );
};

const PictionaryTextTask: React.FC<TaskViewProps> = ({
  state,
  task,
  effectiveSeat,
  userId,
  session,
  controlledSeat,
  remainingSeconds,
  isExpired,
}) => {
  const draftScope = createPictionaryTaskDraftScope(state, task, userId);
  const [text, setText] = useState(() => pictionaryTextDraftStore.read(draftScope) ?? '');
  const command = usePictionaryStageCommand(session, controlledSeat);
  const validationMessage = getTextValidationMessage(text);
  const graphemeCount = getPictionaryTextGraphemeCount(text);
  const isOpeningPrompt = state.stepIndex === 0;
  const isReady = state.readySeats.includes(effectiveSeat);
  if (isOpeningPrompt && task.previousEntry !== null) {
    throw new Error('[FAIL-FAST] Opening Pictionary prompt cannot have previous context');
  }
  if (!isOpeningPrompt && task.previousEntry === null) {
    throw new Error('[FAIL-FAST] Pictionary guess requires previous context');
  }

  const updateText = (nextText: string): void => {
    setText(nextText);
    pictionaryTextDraftStore.write(draftScope, nextText);
  };

  const toggleReady = async (): Promise<void> => {
    if (!isReady && !isValidPictionaryText(text)) return;
    await command.submit(isReady ? '继续编辑' : '完成编辑', {
      type: 'pictionary.task.ready.set',
      isReady: !isReady,
    });
  };

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
      title={isOpeningPrompt ? '写下一个题目' : '猜猜画的是什么'}
      description={
        isOpeningPrompt
          ? '题目会在编辑结束后交给下一位玩家，期间不要告诉其他人。'
          : '只根据画面作答；编辑结束前仍可修改。'
      }
      remainingSeconds={remainingSeconds}
    >
      {!isOpeningPrompt && (
        <PreviousDrawing state={state} task={task} controlledSeat={controlledSeat} />
      )}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={updateText}
          editable={!isReady && !command.isSubmitting && !isExpired}
          maxLength={PICTIONARY_TEXT_DRAFT_MAX_CODE_UNITS}
          multiline
          autoFocus
          placeholder={isOpeningPrompt ? '例如：月球上的猫' : '写下你的猜测'}
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
          accessibilityLabel={isOpeningPrompt ? '接龙题目' : '看图猜词答案'}
          testID={TESTIDS.pictionaryTextInput}
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
              : isReady
                ? '已完成编辑，可在倒计时结束前继续修改'
                : '倒计时结束后才会发送最终内容'}
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
        variant={isReady ? 'secondary' : 'primary'}
        onPress={() => void toggleReady()}
        disabled={(!isReady && validationMessage !== null) || isExpired}
        loading={command.isSubmitting}
        size="lg"
        accessibilityLabel={isReady ? '继续编辑' : '完成编辑'}
        testID={TESTIDS.pictionaryTextSubmitButton}
      >
        {isReady ? '继续编辑' : '完成编辑'}
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
    <Text
      numberOfLines={1}
      style={[styles.toolButtonText, isSelected && styles.selectedToolButtonText]}
    >
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
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.iconAction,
      disabled && styles.disabled,
      pressed && styles.pressed,
    ]}
  >
    <Ionicons name={icon} size={22} color={colors.textSecondary} />
    <Text style={styles.toolButtonText}>{label}</Text>
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
          icon="backspace-outline"
          isSelected={tool === 'eraser'}
          disabled={disabled}
          onPress={() => onToolChange('eraser')}
        />
        <ToolButton
          label="直线"
          icon="remove-outline"
          isSelected={tool === 'line'}
          disabled={disabled}
          onPress={() => onToolChange('line')}
        />
        <ToolButton
          label="矩形"
          icon="square-outline"
          isSelected={tool === 'rectangle'}
          disabled={disabled}
          onPress={() => onToolChange('rectangle')}
        />
        <ToolButton
          label="椭圆"
          icon="ellipse-outline"
          isSelected={tool === 'ellipse'}
          disabled={disabled}
          onPress={() => onToolChange('ellipse')}
        />
        <ToolButton
          label="填充"
          icon="color-fill-outline"
          isSelected={tool === 'fill'}
          disabled={disabled}
          onPress={() => onToolChange('fill')}
        />
      </View>
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

const PictionaryDrawingTask: React.FC<TaskViewProps> = ({
  state,
  task,
  effectiveSeat,
  userId,
  session,
  controlledSeat,
  remainingSeconds,
  isExpired,
}) => {
  const draftScope: PictionaryTaskDraftScope = createPictionaryTaskDraftScope(state, task, userId);
  const [draft, setDraft] = useState(
    () => pictionaryDrawingDraftStore.read(draftScope) ?? EMPTY_PICTIONARY_DRAWING_DRAFT,
  );
  const [tool, setTool] = useState<PictionaryDrawingTool>('brush');
  const [color, setColor] = useState<PictionaryDrawingColor>(PICTIONARY_DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<PictionaryDrawingWidth>(14);
  const command = usePictionaryStageCommand(session, controlledSeat);

  const updateDraft = useCallback(
    (action: PictionaryDrawingDraftAction): void => {
      const current =
        pictionaryDrawingDraftStore.read(draftScope) ?? EMPTY_PICTIONARY_DRAWING_DRAFT;
      const next = reducePictionaryDrawingDraft(current, action);
      pictionaryDrawingDraftStore.write(draftScope, next);
      setDraft(next);
    },
    [draftScope],
  );

  const persistElement = useCallback(
    (element: PictionaryDrawingElement): void => {
      const current =
        pictionaryDrawingDraftStore.read(draftScope) ?? EMPTY_PICTIONARY_DRAWING_DRAFT;
      pictionaryDrawingDraftStore.write(
        draftScope,
        reducePictionaryDrawingDraft(current, {
          type: 'element.add',
          element,
        }),
      );
    },
    [draftScope],
  );

  const addElement = useCallback(
    (element: PictionaryDrawingElement) => updateDraft({ type: 'element.add', element }),
    [updateDraft],
  );

  const fillDrawing = useCallback(
    (point: PictionaryDrawingPoint): void => {
      try {
        const element = createPictionaryFillElement(draft.elements, point, color);
        if (element !== null) addElement(element);
      } catch (error: unknown) {
        handleError(error, {
          label: '填充画布',
          logger: roomScreenLog,
          alertMessage: '无法填充这个区域，请稍后重试。',
        });
      }
    },
    [addElement, color, draft.elements],
  );

  const clearDrawing = (): void => {
    showDestructiveAlert('清空画布？', '所有绘画内容都会被删除。', '清空', () =>
      updateDraft({ type: 'drawing.clear' }),
    );
  };

  const isReady = state.readySeats.includes(effectiveSeat);
  const toggleReady = async (): Promise<void> => {
    if (!isReady && draft.elements.length === 0) return;
    await command.submit(isReady ? '继续编辑' : '完成编辑', {
      type: 'pictionary.task.ready.set',
      isReady: !isReady,
    });
  };

  const previousEntry = task.previousEntry;
  if (previousEntry === null || previousEntry.kind === 'drawing') {
    throw new Error('[FAIL-FAST] Pictionary drawing task requires a text or missed context');
  }
  const isBusy = command.isSubmitting;
  const canEdit = !isReady && !isBusy && !isExpired;
  const canComplete = draft.elements.length > 0 && !isBusy && !isExpired;

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
      title="把这句话画出来"
      description="画面会在编辑结束后传给下一位玩家，不能添加文字提示。"
      remainingSeconds={remainingSeconds}
    >
      <View style={styles.promptStrip}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
        <View style={styles.promptCopy}>
          <Text style={styles.contextLabel}>上一棒</Text>
          <Text style={styles.promptText}>
            {previousEntry.kind === 'text' ? previousEntry.text : '上一棒未完成，请自由发挥'}
          </Text>
        </View>
      </View>
      <PictionaryDrawingCanvas
        elements={draft.elements}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        isEnabled={canEdit}
        onElementChange={persistElement}
        onElementComplete={addElement}
        onFill={fillDrawing}
      />
      <DrawingToolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        canUndo={draft.elements.length > 0}
        canRedo={draft.redoElements.length > 0}
        disabled={!canEdit}
        onToolChange={setTool}
        onColorChange={setColor}
        onWidthChange={setStrokeWidth}
        onUndo={() => updateDraft({ type: 'element.undo' })}
        onRedo={() => updateDraft({ type: 'element.redo' })}
        onClear={clearDrawing}
      />
      {isReady && (
        <View style={styles.uploadNotice}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.info} />
          <Text style={styles.uploadNoticeText}>画稿已保存在本机，可在倒计时结束前继续修改</Text>
        </View>
      )}
      <Button
        variant={isReady ? 'secondary' : 'primary'}
        onPress={() => void toggleReady()}
        disabled={isReady ? isExpired || isBusy : !canComplete}
        loading={isBusy}
        size="lg"
        accessibilityLabel={isReady ? '继续编辑' : '完成编辑'}
        testID={TESTIDS.pictionaryDrawingSubmitButton}
      >
        {isReady ? '继续编辑' : '完成编辑'}
      </Button>
    </PictionaryStageFrame>
  );
};

interface WaitingStageProps {
  readonly state: PictionaryState;
  readonly remainingSeconds: number | null;
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}

const PictionaryWaitingStage: React.FC<WaitingStageProps> = ({
  state,
  remainingSeconds,
  title,
  description,
  children,
}) => {
  const completedCount = getPictionaryCompletedCount(state);
  const pendingCount = Math.max(0, state.config.numberOfPlayers - completedCount);
  const completedLabel = state.phase === 'answering' ? '人已完成编辑' : '人已送达';
  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
      title={title}
      description={description}
      remainingSeconds={remainingSeconds}
    >
      <View style={styles.waitingBody}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.waitingCount}>
          {completedCount} {completedLabel}
        </Text>
        <View style={styles.progressTrack}>
          {completedCount > 0 && <View style={[styles.progressDone, { flex: completedCount }]} />}
          {pendingCount > 0 && <View style={{ flex: pendingCount }} />}
        </View>
        <Text style={styles.waitingHint}>所有人完成后会自动交换任务</Text>
        {children}
      </View>
    </PictionaryStageFrame>
  );
};

export const PictionaryTaskStage: React.FC<PictionaryTaskStageProps> = ({
  state,
  effectiveSeat,
  controlledSeat,
  userId,
  session,
  remainingSeconds,
  isExpired,
  draftFinalizer,
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
  if (state.phase === 'settling') {
    const description =
      draftFinalizer.status === 'failed'
        ? '本机最终内容发送失败，草稿仍保存在本机。'
        : draftFinalizer.status === 'empty'
          ? '本机没有这一棒的草稿。如果在其他设备作答，请回到原设备交稿。'
          : draftFinalizer.status === 'waiting'
            ? '本机最终内容已处理，正在等待其他玩家。'
            : '正在发送本机保存的最终内容，请保持页面打开。';
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在收取最终内容"
        description={description}
      >
        {draftFinalizer.status === 'empty' && (
          <Button
            variant="secondary"
            onPress={() =>
              showConfirmAlert(
                '确认提交空白？',
                '仅在这一棒确实没有输入文字或画画时提交空白。其他设备上的草稿不会自动转移到本机。',
                draftFinalizer.submitEmpty,
                { confirmText: '提交空白' },
              )
            }
          >
            提交空白
          </Button>
        )}
        {draftFinalizer.status === 'failed' && (
          <Button variant="secondary" onPress={draftFinalizer.retry}>
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
  return task.expectedKind === 'text' ? (
    <PictionaryTextTask
      key={`${state.roundId}:${state.stepIndex}:${task.chain.id}:${userId}`}
      state={state}
      task={task}
      effectiveSeat={effectiveSeat}
      userId={userId}
      session={session}
      controlledSeat={controlledSeat}
      remainingSeconds={remainingSeconds}
      isExpired={isExpired}
    />
  ) : (
    <PictionaryDrawingTask
      key={`${state.roundId}:${state.stepIndex}:${task.chain.id}:${userId}`}
      state={state}
      task={task}
      effectiveSeat={effectiveSeat}
      userId={userId}
      session={session}
      controlledSeat={controlledSeat}
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
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  toolButton: {
    minHeight: fixed.minTouchTarget,
    width: '33.333%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.tight,
    backgroundColor: colors.surface,
  },
  selectedToolButton: { backgroundColor: colors.primary },
  toolButtonText: { ...textStyles.secondarySemibold, color: colors.textSecondary },
  selectedToolButtonText: { color: colors.textInverse },
  historyActions: { flexDirection: 'row', gap: spacing.tight },
  iconAction: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    gap: spacing.tight,
    paddingHorizontal: spacing.small,
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

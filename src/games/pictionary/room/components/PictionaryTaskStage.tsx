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
import { randomPick } from '@game-judge/game-engine/platform/random';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import { Button } from '@/components/Button';
import { DrawingToolbar } from '@/components/DrawingToolbar/DrawingToolbar';
import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import {
  EMPTY_PICTIONARY_DRAWING_DRAFT,
  isPictionaryDrawingColor,
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
import { createPictionaryFillElement } from '@/games/pictionary/services/renderPictionaryDrawing';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  fixed,
  shadows,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type {
  PictionarySubmissionStatus,
  PictionaryTaskInput,
} from '../hooks/usePictionaryAutoSubmission';
import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { PictionaryDrawingCanvas } from './PictionaryDrawingCanvas';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PictionaryStageFrame } from './PictionaryStageFrame';
import { PictionaryTaskFrame, PictionaryTaskMedia } from './PictionaryTaskFrame';

const PICTIONARY_OPENING_PROMPT_EXAMPLES = [
  '月球上的猫',
  '骑单车的熊猫',
  '撑雨伞的蘑菇',
  '吃西瓜的雪人',
  '坐地铁的外星人',
  '在云朵上钓鱼',
  '给太阳戴墨镜',
  '背着书包的恐龙',
  '穿拖鞋的企鹅',
  '火山里煮火锅',
  '骑扫帚送外卖',
  '海底开生日派对',
  '会飞的冰箱',
  '长出翅膀的西瓜',
  '在彩虹上滑滑梯',
  '用面条织围巾',
  '抱着月亮睡觉',
  '蜗牛开赛车',
  '章鱼打鼓',
  '长颈鹿打篮球',
  '机器人放风筝',
  '兔子在月亮上露营',
  '鸭子当船长',
  '猫咪给鱼拍照',
  '刺猬卖气球',
  '雪人泡温泉',
  '小狗开挖掘机',
  '螃蟹剪头发',
  '吐泡泡的茶壶',
  '热气球上吃早餐',
] as const;

interface PictionaryTaskStageProps {
  readonly inputs: Map<number, PictionaryTaskInput>;
  readonly state: PictionaryState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly session: PictionaryRoomSession;
  readonly remainingSeconds: number | null;
  readonly isExpired: boolean;
  readonly autoSubmission: {
    readonly status: PictionarySubmissionStatus;
    readonly retry: () => void;
  };
}

interface TaskViewProps {
  readonly inputs: Map<number, PictionaryTaskInput>;
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
        <Text style={styles.missedContextText}>上一棒未完成，请自由发挥</Text>
      </View>
    );
  }
  if (previousEntry.kind !== 'drawing') {
    throw new Error('[FAIL-FAST] Pictionary text task requires a drawing context');
  }
  return (
    <View style={styles.contextBlock}>
      <Text style={styles.contextLabel}>上一棒画作</Text>
      <PictionaryTaskMedia>
        <PictionaryDrawingImage
          roomCode={state.roomCode}
          entryId={previousEntry.id}
          accessibilityLabel="上一棒画作"
          controlledSeat={controlledSeat}
        />
      </PictionaryTaskMedia>
    </View>
  );
};

const PictionaryTextTask: React.FC<TaskViewProps> = ({
  inputs,
  state,
  task,
  effectiveSeat,
  session,
  controlledSeat,
  remainingSeconds,
  isExpired,
}) => {
  const [text, setText] = useState(() => {
    const input = inputs.get(effectiveSeat);
    if (input !== undefined && typeof input !== 'string') throw new Error('Expected text input');
    return input ?? '';
  });
  const [openingPromptExample] = useState(() => randomPick(PICTIONARY_OPENING_PROMPT_EXAMPLES));
  const command = usePictionaryStageCommand(session, controlledSeat, state, effectiveSeat);
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
    inputs.set(effectiveSeat, nextText);
  };

  const toggleReady = async (): Promise<void> => {
    if (!isReady && !isValidPictionaryText(text)) return;
    await command.submit(isReady ? '继续编辑' : '完成编辑', {
      type: 'pictionary.task.ready.set',
      isReady: !isReady,
    });
  };

  return (
    <PictionaryTaskFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
      title={isOpeningPrompt ? '写下一个题目' : '猜猜画的是什么'}
      remainingSeconds={remainingSeconds}
      footer={
        <View style={styles.taskFooter}>
          <View style={styles.primaryAction}>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              onPress={() => void toggleReady()}
              disabled={(!isReady && validationMessage !== null) || isExpired}
              loading={command.isSubmitting}
              size="md"
              accessibilityLabel={isReady ? '继续编辑' : '完成编辑'}
              testID={TESTIDS.pictionaryTextSubmitButton}
            >
              {isReady ? '继续编辑' : '完成编辑'}
            </Button>
          </View>
        </View>
      }
    >
      {!isOpeningPrompt && (
        <PreviousDrawing state={state} task={task} controlledSeat={controlledSeat} />
      )}
      <View style={[styles.composer, isOpeningPrompt && styles.openingComposer]}>
        <TextInput
          value={text}
          onChangeText={updateText}
          editable={!isReady && !command.isSubmitting && !isExpired}
          maxLength={PICTIONARY_TEXT_MAX_LENGTH}
          multiline
          placeholder={isOpeningPrompt ? `例如：${openingPromptExample}` : '写下你的猜测'}
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
                ? '已就绪'
                : ''}
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
    </PictionaryTaskFrame>
  );
};

const PictionaryDrawingTask: React.FC<TaskViewProps> = ({
  inputs,
  state,
  task,
  effectiveSeat,
  session,
  controlledSeat,
  remainingSeconds,
  isExpired,
}) => {
  const [draft, setDraft] = useState(() => {
    const input = inputs.get(effectiveSeat);
    if (typeof input === 'string') throw new Error('Expected drawing input');
    return input ?? EMPTY_PICTIONARY_DRAWING_DRAFT;
  });
  const [tool, setTool] = useState<PictionaryDrawingTool>('brush');
  const [color, setColor] = useState<PictionaryDrawingColor>(PICTIONARY_DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<PictionaryDrawingWidth>(14);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const command = usePictionaryStageCommand(session, controlledSeat, state, effectiveSeat);

  const updateDraft = useCallback(
    (action: PictionaryDrawingDraftAction): void => {
      const next = reducePictionaryDrawingDraft(draft, action);
      inputs.set(effectiveSeat, next);
      setDraft(next);
    },
    [draft, inputs, effectiveSeat],
  );

  const persistElement = useCallback(
    (element: PictionaryDrawingElement): void => {
      inputs.set(
        effectiveSeat,
        reducePictionaryDrawingDraft(draft, {
          type: 'element.add',
          element,
        }),
      );
    },
    [draft, inputs, effectiveSeat],
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
    setShowClearConfirm(true);
  };

  const confirmClearDrawing = (): void => {
    setShowClearConfirm(false);
    updateDraft({ type: 'drawing.clear' });
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
    <>
      <PictionaryTaskFrame
        eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
        title="把这句话画出来"
        remainingSeconds={remainingSeconds}
        footer={
          <>
            <DrawingToolbar
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              canUndo={draft.elements.length > 0}
              canRedo={draft.redoElements.length > 0}
              disabled={!canEdit}
              palette={PICTIONARY_DRAWING_PALETTE}
              widths={[...PICTIONARY_DRAWING_WIDTHS]}
              onToolChange={(t) => setTool(t)}
              onColorChange={(c) => {
                if (isPictionaryDrawingColor(c)) setColor(c);
              }}
              onWidthChange={(w) => {
                const valid = PICTIONARY_DRAWING_WIDTHS.find((v) => v === w);
                if (valid !== undefined) setStrokeWidth(valid);
              }}
              onUndo={() => updateDraft({ type: 'element.undo' })}
              onRedo={() => updateDraft({ type: 'element.redo' })}
              onClear={clearDrawing}
            />
            <View style={styles.taskFooter}>
              <View style={styles.primaryAction}>
                <Button
                  variant={isReady ? 'secondary' : 'primary'}
                  onPress={() => void toggleReady()}
                  disabled={isReady ? isExpired || isBusy : !canComplete}
                  loading={isBusy}
                  size="md"
                  accessibilityLabel={isReady ? '继续编辑' : '完成编辑'}
                  testID={TESTIDS.pictionaryDrawingSubmitButton}
                >
                  {isReady ? '继续编辑' : '完成编辑'}
                </Button>
              </View>
            </View>
          </>
        }
      >
        <View style={styles.promptStrip}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          <View style={styles.promptCopy}>
            <Text style={styles.contextLabel}>上一棒</Text>
            <ScrollView style={styles.promptScroll} nestedScrollEnabled>
              <Text style={styles.promptText}>
                {previousEntry.kind === 'text' ? previousEntry.text : '上一棒未完成，请自由发挥'}
              </Text>
            </ScrollView>
          </View>
        </View>
        <PictionaryTaskMedia>
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
        </PictionaryTaskMedia>
      </PictionaryTaskFrame>
      <AlertModal
        visible={showClearConfirm}
        title="清空画布？"
        message="所有绘画内容都会被删除。"
        buttons={[
          { text: '取消', style: 'cancel', onPress: () => setShowClearConfirm(false) },
          { text: '清空', style: 'destructive', onPress: confirmClearDrawing },
        ]}
        onClose={() => setShowClearConfirm(false)}
      />
    </>
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
        {state.phase === 'settling' && (
          <Text style={styles.waitingHint}>
            等待期间请留在 App/小程序内并保持联网，以免收稿卡住
          </Text>
        )}
        {children}
      </View>
    </PictionaryStageFrame>
  );
};

export const PictionaryTaskStage: React.FC<PictionaryTaskStageProps> = ({
  inputs,
  state,
  effectiveSeat,
  controlledSeat,
  userId,
  session,
  remainingSeconds,
  isExpired,
  autoSubmission,
}) => {
  const task = effectiveSeat === null ? null : getPictionaryTaskForSeat(state, effectiveSeat);
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
      autoSubmission.status === 'failed'
        ? '内容发送失败，请重试。'
        : autoSubmission.status === 'retrying'
          ? '发送暂未成功，正在自动重试。'
          : autoSubmission.status === 'waiting'
            ? '你的内容已处理，正在等待其他玩家。'
            : '正在自动提交本棒内容，请留在 App/小程序内。';
    return (
      <PictionaryWaitingStage
        state={state}
        remainingSeconds={remainingSeconds}
        title="正在收取最终内容"
        description={description}
      >
        {autoSubmission.status === 'failed' && (
          <Button variant="secondary" onPress={autoSubmission.retry}>
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
  if (task === null) {
    throw new Error('[FAIL-FAST] Seated Pictionary player has no task');
  }
  return task.expectedKind === 'text' ? (
    <PictionaryTextTask
      inputs={inputs}
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
      inputs={inputs}
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
  taskFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  primaryAction: { flex: 1 },
  contextBlock: { flex: 1, minHeight: 0, gap: spacing.tight },
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
    flexShrink: 1,
    minHeight: fixed.minTouchTarget,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  textInput: {
    minHeight: fixed.minTouchTarget,
    height: fixed.minTouchTarget * 2,
    flexShrink: 1,
    padding: spacing.small,
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
    padding: spacing.small,
    borderLeftWidth: fixed.borderWidthHighlight,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  promptCopy: { flex: 1, minWidth: 0 },
  promptScroll: { maxHeight: fixed.minTouchTarget },
  promptText: { ...textStyles.bodyMedium, color: colors.text },
  openingComposer: { marginTop: spacing.medium },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.tight,
    borderTopWidth: fixed.borderWidth,
    borderBottomWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  optionsPanel: roomSurfaceStyles.dialog,
  colorButtonAnchor: { flex: 1 },
  colorOptions: {
    position: 'absolute',
    padding: spacing.medium,
    paddingTop: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    ...shadows.sm,
  },
  colorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  colorTitle: { ...roomSurfaceStyles.title, flex: 1 },
  colorCurrent: {
    width: spacing.large,
    height: spacing.large,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  colorPaletteBody: { gap: spacing.small },
  colorPickerArea: { height: 240, flexShrink: 1 },
  colorPicker: { gap: spacing.small },
  colorPanel: { width: '100%', height: 144, borderRadius: borderRadius.small },
  hueSlider: { borderRadius: borderRadius.small },
  colorPreview: {
    width: '100%',
    height: spacing.large,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  colorSwatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.tight,
    maxWidth: 320 - spacing.medium * 2,
  },
  recentColorSection: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.small,
  },
  recentColorTitle: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
  },
  colorTile: {
    width: spacing.xlarge,
    height: spacing.xlarge,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  panelHeader: roomSurfaceStyles.header,
  panelTitle: { ...roomSurfaceStyles.title, flex: 1 },
  closeButton: { width: fixed.minTouchTarget },
  toolOption: { width: fixed.minTouchTarget },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  toolButton: {
    minHeight: fixed.minTouchTarget,
    flex: 1,
    minWidth: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.tight,
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.transparent,
  },
  selectedToolButton: {
    backgroundColor: withAlpha(colors.primary, 0.15),
    borderColor: colors.primary,
  },
  labeledToolButton: {
    height: fixed.minTouchTarget + spacing.medium,
    maxHeight: fixed.minTouchTarget + spacing.medium,
    flexDirection: 'column',
  },
  toolPreview: {
    height: Math.max(...PICTIONARY_DRAWING_WIDTHS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCaption: { ...textStyles.caption, color: colors.textSecondary, textAlign: 'center' },
  selectedToolCaption: { color: colors.primary },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    minWidth: fixed.minTouchTarget,
    padding: spacing.tight,
    backgroundColor: colors.text,
    borderRadius: borderRadius.small,
    zIndex: 1,
  },
  tooltipText: { ...textStyles.caption, color: colors.textInverse, textAlign: 'center' },
  swatchButton: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.transparent,
    borderRadius: borderRadius.full,
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
  selectedWidthButton: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
  widthPreview: { borderRadius: borderRadius.full },
  waitingBody: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
  },
  waitingCount: roomSurfaceStyles.title,
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

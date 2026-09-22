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
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, {
  type ColorFormatsObject,
  colorKit,
  HueSlider,
  Panel1,
  Preview,
} from 'reanimated-color-picker';

import { Modal } from '@/components/AppModal';
import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
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
import { showDestructiveAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { PictionaryDraftFinalizationStatus } from '../hooks/usePictionaryDraftFinalizer';
import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { PictionaryDrawingCanvas } from './PictionaryDrawingCanvas';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PictionaryStageFrame } from './PictionaryStageFrame';
import { PictionaryTaskFrame, PictionaryTaskMedia } from './PictionaryTaskFrame';

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
    <PictionaryTaskFrame
      eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
      title={isOpeningPrompt ? '写下一个题目' : '猜猜画的是什么'}
      remainingSeconds={remainingSeconds}
      footer={
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
          maxLength={PICTIONARY_TEXT_DRAFT_MAX_CODE_UNITS}
          multiline
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

interface ToolButtonProps {
  readonly label: string;
  readonly caption?: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children?: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  label,
  caption = label,
  icon,
  isSelected,
  disabled,
  onPress,
  children,
}) => {
  const [isLabelVisible, setIsLabelVisible] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setIsLabelVisible(true)}
      onHoverOut={() => setIsLabelVisible(false)}
      onFocus={() => setIsLabelVisible(true)}
      onBlur={() => setIsLabelVisible(false)}
      style={({ pressed }) => [
        styles.toolButton,
        styles.labeledToolButton,
        isSelected && styles.selectedToolButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.toolPreview}>
        {children ?? (
          <Ionicons
            name={icon}
            size={18}
            color={isSelected ? colors.primary : colors.textSecondary}
          />
        )}
      </View>
      <Text style={[styles.toolCaption, isSelected && styles.selectedToolCaption]}>{caption}</Text>
      {isLabelVisible && (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

interface IconActionProps {
  readonly label: string;
  readonly caption?: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly disabled: boolean;
  readonly onPress: () => void;
}

const IconAction: React.FC<IconActionProps> = ({
  label,
  caption = label,
  icon,
  disabled,
  onPress,
}) => (
  <ToolButton
    label={label}
    caption={caption}
    icon={icon}
    disabled={disabled}
    onPress={onPress}
    isSelected={false}
  />
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

const toolOptions = [
  { tool: 'brush', label: '画笔', icon: 'brush-outline' },
  { tool: 'eraser', label: '橡皮', icon: 'backspace-outline' },
  { tool: 'line', label: '直线', icon: 'remove-outline' },
  { tool: 'rectangle', label: '矩形', icon: 'square-outline' },
  { tool: 'ellipse', label: '椭圆', icon: 'ellipse-outline' },
  { tool: 'fill', label: '填充', icon: 'color-fill-outline' },
] as const satisfies readonly {
  tool: PictionaryDrawingTool;
  label: string;
  icon: ToolButtonProps['icon'];
}[];

type DrawingPanel = 'tool' | 'color' | 'width';

interface DrawingOptionsProps {
  readonly activePanel: DrawingPanel;
  readonly toolbar: DrawingToolbarProps;
  readonly onClose: () => void;
}

const COLOR_POPOVER_WIDTH = 320;
const COLOR_SHEET_BREAKPOINT = 600;
const RECENT_COLOR_COUNT = 5;

interface ColorOptionButtonProps {
  readonly label: string;
  readonly isSelected?: boolean;
  readonly onPress: () => void;
  readonly children: React.ReactNode;
}

const ColorOptionButton: React.FC<ColorOptionButtonProps> = ({
  label,
  isSelected = false,
  onPress,
  children,
}) => {
  const [isLabelVisible, setIsLabelVisible] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      onHoverIn={() => setIsLabelVisible(true)}
      onHoverOut={() => setIsLabelVisible(false)}
      onFocus={() => setIsLabelVisible(true)}
      onBlur={() => setIsLabelVisible(false)}
      style={[styles.swatchButton, isSelected && styles.selectedSwatchButton]}
    >
      {children}
      {isLabelVisible && (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const DrawingColorSwatch: React.FC<{
  readonly color: PictionaryDrawingColor;
  readonly label: string;
  readonly toolbar: DrawingToolbarProps;
  readonly onClose: () => void;
}> = ({ color, label, toolbar, onClose }) => {
  const isSelected = toolbar.color.toUpperCase() === color.toUpperCase();
  return (
    <ColorOptionButton
      label={label}
      isSelected={isSelected}
      onPress={() => {
        toolbar.onColorChange(color);
        onClose();
      }}
    >
      <View style={[styles.colorTile, { backgroundColor: color }]}>
        {isSelected && (
          <Ionicons
            name="checkmark"
            size={spacing.screenH}
            color={colorKit.isDark(color) ? colors.textInverse : colors.text}
          />
        )}
      </View>
    </ColorOptionButton>
  );
};

interface DrawingColorOptionsProps extends Omit<DrawingOptionsProps, 'activePanel'> {
  readonly anchor: { readonly left: number; readonly top: number };
  readonly recentColors: readonly PictionaryDrawingColor[];
}

const DrawingColorPicker: React.FC<{ readonly toolbar: DrawingToolbarProps }> = ({ toolbar }) => {
  const onColorPick = ({ hex }: ColorFormatsObject) => {
    if (!isPictionaryDrawingColor(hex)) {
      throw new Error('[FAIL-FAST] Pictionary picker returned an invalid opaque color');
    }
    toolbar.onColorChange(hex);
  };
  return (
    <GestureHandlerRootView style={styles.colorPickerArea}>
      <GestureScrollView>
        <ColorPicker
          value={toolbar.color}
          onCompleteJS={onColorPick}
          boundedThumb
          enableColorAnnouncements={false}
          sliderThickness={fixed.minTouchTarget}
          thumbSize={spacing.large}
          style={styles.colorPicker}
        >
          <Panel1
            accessibilityLabel="饱和度与明度"
            accessibilityHint="左右调整饱和度，上下调整明度"
            style={styles.colorPanel}
          />
          <HueSlider accessibilityLabel="色相" style={styles.hueSlider} />
          <View accessibilityLabel="当前颜色预览">
            <Preview hideText style={styles.colorPreview} />
          </View>
        </ColorPicker>
      </GestureScrollView>
    </GestureHandlerRootView>
  );
};

const DrawingColorOptions: React.FC<DrawingColorOptionsProps> = ({
  toolbar,
  onClose,
  anchor,
  recentColors,
}) => {
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < COLOR_SHEET_BREAKPOINT;
  const position = isCompact
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: height - insets.top - spacing.medium,
        paddingBottom: Math.max(insets.bottom, spacing.medium),
      }
    : {
        left: Math.max(
          spacing.small,
          Math.min(anchor.left, width - COLOR_POPOVER_WIDTH - spacing.small),
        ),
        bottom: height - anchor.top + spacing.small,
        width: COLOR_POPOVER_WIDTH,
        maxHeight: anchor.top - insets.top - spacing.medium,
      };
  return (
    <Modal visible={!toolbar.disabled} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityLabel="关闭颜色面板"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityLabel="画笔颜色面板" style={[styles.colorOptions, position]}>
          <View style={styles.colorHeader}>
            {isColorPickerVisible && (
              <ColorOptionButton
                label="返回常用颜色"
                onPress={() => setIsColorPickerVisible(false)}
              >
                <Ionicons name="arrow-back" size={spacing.screenH} color={colors.text} />
              </ColorOptionButton>
            )}
            <Text accessibilityRole="header" style={styles.colorTitle}>
              {isColorPickerVisible ? '调色板' : '颜色'}
            </Text>
            <View
              accessibilityLabel="当前颜色"
              style={[styles.colorCurrent, { backgroundColor: toolbar.color }]}
            />
            <ColorOptionButton label="关闭选择面板" onPress={onClose}>
              <Ionicons name="close" size={spacing.screenH} color={colors.textSecondary} />
            </ColorOptionButton>
          </View>
          {isColorPickerVisible ? (
            <DrawingColorPicker toolbar={toolbar} />
          ) : (
            <View style={styles.colorPaletteBody}>
              <View style={styles.colorSwatches}>
                {PICTIONARY_DRAWING_PALETTE.map((swatch) => (
                  <DrawingColorSwatch
                    key={swatch.value}
                    color={swatch.value}
                    label={swatch.name}
                    toolbar={toolbar}
                    onClose={onClose}
                  />
                ))}
                <ColorOptionButton label="展开调色板" onPress={() => setIsColorPickerVisible(true)}>
                  <LinearGradient
                    colors={[
                      PICTIONARY_DRAWING_PALETTE[2].value,
                      PICTIONARY_DRAWING_PALETTE[4].value,
                      PICTIONARY_DRAWING_PALETTE[5].value,
                      PICTIONARY_DRAWING_PALETTE[7].value,
                      PICTIONARY_DRAWING_PALETTE[8].value,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.colorTile}
                  >
                    <Ionicons name="add" size={spacing.large} color={colors.textInverse} />
                  </LinearGradient>
                </ColorOptionButton>
              </View>
              {recentColors.length > 0 && (
                <View style={styles.recentColorSection}>
                  <Text style={styles.recentColorTitle}>最近使用</Text>
                  <View style={styles.colorSwatches}>
                    {recentColors.map((color, index) => (
                      <DrawingColorSwatch
                        key={color}
                        color={color}
                        label={`最近颜色 ${index + 1}`}
                        toolbar={toolbar}
                        onClose={onClose}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const DrawingOptions: React.FC<DrawingOptionsProps> = ({ activePanel, toolbar, onClose }) => (
  <View style={styles.optionGrid}>
    {activePanel === 'tool' && (
      <>
        {toolOptions.map((option) => (
          <View key={option.tool} style={styles.toolOption}>
            <ToolButton
              label={option.label}
              icon={option.icon}
              isSelected={toolbar.tool === option.tool}
              disabled={toolbar.disabled}
              onPress={() => {
                toolbar.onToolChange(option.tool);
                onClose();
              }}
            />
          </View>
        ))}
        <View style={styles.toolOption}>
          <IconAction
            label="清空画布"
            caption="清空"
            icon="trash-outline"
            disabled={toolbar.disabled || !toolbar.canUndo}
            onPress={() => {
              onClose();
              toolbar.onClear();
            }}
          />
        </View>
      </>
    )}
    {activePanel === 'width' &&
      PICTIONARY_DRAWING_WIDTHS.map((width) => (
        <Pressable
          key={width}
          accessibilityRole="button"
          accessibilityLabel={`${width} 像素画笔`}
          accessibilityState={{
            selected: toolbar.strokeWidth === width,
            disabled: toolbar.disabled,
          }}
          disabled={toolbar.disabled}
          onPress={() => {
            toolbar.onWidthChange(width);
            onClose();
          }}
          style={[styles.widthButton, toolbar.strokeWidth === width && styles.selectedWidthButton]}
        >
          <View
            style={[
              styles.widthPreview,
              {
                width,
                height: width,
                backgroundColor: toolbar.tool === 'eraser' ? colors.textMuted : toolbar.color,
              },
            ]}
          />
        </Pressable>
      ))}
  </View>
);

const DrawingToolbar: React.FC<DrawingToolbarProps> = (toolbar) => {
  const [activePanel, setActivePanel] = useState<DrawingPanel | null>(null);
  const [recentColors, setRecentColors] = useState<readonly PictionaryDrawingColor[]>([]);
  const [colorAnchor, setColorAnchor] = useState<DrawingColorOptionsProps['anchor'] | null>(null);
  const colorButtonRef = useRef<View>(null);
  const { width, height } = useWindowDimensions();
  useLayoutEffect(() => {
    if (activePanel === 'color') {
      colorButtonRef.current?.measureInWindow((left, top) => setColorAnchor({ left, top }));
    }
  }, [activePanel, width, height]);
  const rememberColor = () => {
    const color = toolbar.color;
    if (!PICTIONARY_DRAWING_PALETTE.some((swatch) => swatch.value === color.toUpperCase())) {
      setRecentColors((previous) =>
        [color, ...previous.filter((entry) => entry.toUpperCase() !== color.toUpperCase())].slice(
          0,
          RECENT_COLOR_COUNT,
        ),
      );
    }
  };
  const selectedTool = toolOptions.find((option) => option.tool === toolbar.tool);
  const selectedColor = PICTIONARY_DRAWING_PALETTE.find(
    (swatch) => swatch.value === toolbar.color.toUpperCase(),
  );
  if (selectedTool === undefined) {
    throw new Error('[FAIL-FAST] Unknown Pictionary drawing tool');
  }
  const onClose = () => setActivePanel(null);
  const panelTitle =
    activePanel === 'tool' ? '绘画工具' : activePanel === 'color' ? '画笔颜色' : '画笔粗细';

  return (
    <View style={styles.toolbar}>
      <ToolButton
        label={`选择工具，当前${selectedTool.label}`}
        caption={selectedTool.label}
        icon={selectedTool.icon}
        isSelected={false}
        disabled={toolbar.disabled}
        onPress={() => setActivePanel('tool')}
      />
      <View ref={colorButtonRef} collapsable={false} style={styles.colorButtonAnchor}>
        <ToolButton
          label={`选择颜色，当前${selectedColor === undefined ? '自定义颜色' : selectedColor.name}`}
          caption="颜色"
          icon="color-palette-outline"
          isSelected={false}
          disabled={toolbar.disabled}
          onPress={() => setActivePanel('color')}
        >
          <View style={[styles.swatch, { backgroundColor: toolbar.color }]} />
        </ToolButton>
      </View>
      <ToolButton
        label={`选择粗细，当前 ${toolbar.strokeWidth} 像素`}
        caption="粗细"
        icon="ellipse"
        isSelected={false}
        disabled={toolbar.disabled}
        onPress={() => setActivePanel('width')}
      >
        <View
          style={[
            styles.widthPreview,
            {
              width: toolbar.strokeWidth,
              height: toolbar.strokeWidth,
              backgroundColor: toolbar.tool === 'eraser' ? colors.textMuted : toolbar.color,
            },
          ]}
        />
      </ToolButton>
      <IconAction
        label="撤销"
        icon="arrow-undo-outline"
        disabled={toolbar.disabled || !toolbar.canUndo}
        onPress={toolbar.onUndo}
      />
      <IconAction
        label="重做"
        icon="arrow-redo-outline"
        disabled={toolbar.disabled || !toolbar.canRedo}
        onPress={toolbar.onRedo}
      />
      {activePanel === 'color' && colorAnchor !== null && (
        <DrawingColorOptions
          toolbar={toolbar}
          anchor={colorAnchor}
          recentColors={recentColors}
          onClose={() => {
            rememberColor();
            onClose();
          }}
        />
      )}
      {activePanel !== null && activePanel !== 'color' && (
        <BaseCenterModal
          visible={!toolbar.disabled}
          onClose={onClose}
          dismissOnOverlayPress
          animationType="none"
          contentStyle={styles.optionsPanel}
        >
          <View style={styles.panelHeader}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              {panelTitle}
            </Text>
            <View style={styles.closeButton}>
              <IconAction
                label="关闭选择面板"
                caption="关闭"
                icon="close"
                disabled={false}
                onPress={onClose}
              />
            </View>
          </View>
          <ScrollView
            style={roomSurfaceStyles.scroll}
            contentContainerStyle={roomSurfaceStyles.content}
          >
            <DrawingOptions activePanel={activePanel} toolbar={toolbar} onClose={onClose} />
          </ScrollView>
        </BaseCenterModal>
      )}
    </View>
  );
};

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
            onToolChange={setTool}
            onColorChange={setColor}
            onWidthChange={setStrokeWidth}
            onUndo={() => updateDraft({ type: 'element.undo' })}
            onRedo={() => updateDraft({ type: 'element.redo' })}
            onClear={clearDrawing}
          />
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
        : draftFinalizer.status === 'retrying'
          ? '发送暂未成功，正在自动重试。草稿已保留，恢复连接后会继续发送。'
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
    maxWidth: COLOR_POPOVER_WIDTH - spacing.medium * 2,
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

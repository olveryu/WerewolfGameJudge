/**
 * 共用画画工具栏：Pictionary 与你画我猜共用，防 drift。
 *
 * 紧凑模式：工具 / 颜色 / 粗细 / 撤销 / 重做（可选）/ 清空。
 * 点开弹出面板；颜色面板含 HSV 调色板 + 预设色 + 最近使用。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  withAlpha,
} from '@/theme';

export type SharedDrawingTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'fill';

export interface DrawingPaletteEntry {
  readonly value: string;
  readonly name: string;
}

export interface SharedDrawingToolbarProps {
  readonly tool: SharedDrawingTool;
  readonly color: string;
  readonly strokeWidth: number;
  readonly canUndo: boolean;
  readonly canRedo?: boolean;
  readonly disabled: boolean;
  readonly palette: readonly DrawingPaletteEntry[];
  readonly widths: readonly number[];
  readonly onToolChange: (tool: SharedDrawingTool) => void;
  readonly onColorChange: (color: string) => void;
  readonly onWidthChange: (width: number) => void;
  readonly onUndo: () => void;
  readonly onRedo?: () => void;
  readonly onClear: () => void;
}

const TOOL_OPTIONS = [
  { tool: 'brush', label: '画笔', icon: 'brush-outline' },
  { tool: 'eraser', label: '橡皮', icon: 'backspace-outline' },
  { tool: 'line', label: '直线', icon: 'remove-outline' },
  { tool: 'rectangle', label: '矩形', icon: 'square-outline' },
  { tool: 'ellipse', label: '椭圆', icon: 'ellipse-outline' },
  { tool: 'fill', label: '填充', icon: 'color-fill-outline' },
] as const satisfies readonly {
  readonly tool: SharedDrawingTool;
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
}[];

const RECENT_COLOR_COUNT = 5;
const WIDE_BREAKPOINT = 768;

type ToolbarPanel = 'tool' | 'color' | 'width';

function ToolButton({
  label,
  caption,
  icon,
  isSelected = false,
  disabled,
  onPress,
  children,
}: {
  readonly label: string;
  readonly caption: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly isSelected?: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children?: React.ReactNode;
}) {
  const [isLabelVisible, setIsLabelVisible] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setIsLabelVisible(true)}
      onHoverOut={() => setIsLabelVisible(false)}
      onFocus={() => setIsLabelVisible(true)}
      onBlur={() => setIsLabelVisible(false)}
      style={({ pressed }) => [
        styles.toolButton,
        isSelected && styles.selectedToolButton,
        disabled && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
      <Text style={styles.toolLabel}>{caption}</Text>
      {children}
      {isLabelVisible && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function IconAction({
  label,
  icon,
  disabled,
  onPress,
}: {
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.toolButton, disabled && styles.dimmed]}
    >
      <Ionicons
        name={icon}
        size={componentSizes.icon.md}
        color={disabled ? colors.textMuted : colors.text}
      />
      <Text style={[styles.toolLabel, disabled && styles.dimmedText]}>{label}</Text>
    </Pressable>
  );
}

function ColorPickerPanel({
  color,
  onColorChange,
}: {
  readonly color: string;
  readonly onColorChange: (hex: string) => void;
}) {
  const handleComplete = ({ hex }: ColorFormatsObject) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      throw new Error('[FAIL-FAST] Color picker returned an invalid opaque color');
    }
    onColorChange(hex);
  };
  return (
    <GestureHandlerRootView style={styles.colorPickerArea}>
      <GestureScrollView>
        <ColorPicker
          value={color}
          onCompleteJS={handleComplete}
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
}

const COLOR_POPOVER_WIDTH = 320;
const COLOR_SHEET_BREAKPOINT = 600;

export const DrawingToolbar: React.FC<SharedDrawingToolbarProps> = (props) => {
  const [activePanel, setActivePanel] = useState<ToolbarPanel | null>(null);
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);
  const [panelAnchor, setPanelAnchor] = useState<{ left: number; top: number } | null>(null);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const buttonRef = useRef<View>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < WIDE_BREAKPOINT;
  const { disabled } = props;

  useLayoutEffect(() => {
    if (activePanel !== null) {
      buttonRef.current?.measureInWindow((left, top) => setPanelAnchor({ left, top }));
    } else {
      setIsColorPickerVisible(false);
    }
  }, [activePanel, width, height]);

  const rememberColor = (hex: string) => {
    if (props.palette.some((swatch) => swatch.value.toUpperCase() === hex.toUpperCase())) return;
    setRecentColors((previous) =>
      [hex, ...previous.filter((entry) => entry.toUpperCase() !== hex.toUpperCase())].slice(
        0,
        RECENT_COLOR_COUNT,
      ),
    );
  };

  const handleColorChange = (hex: string) => {
    props.onColorChange(hex);
  };

  const handleColorPanelClose = () => {
    rememberColor(props.color);
    setActivePanel(null);
  };

  const confirmClear = () => {
    if (disabled) return;
    // 确认框由各游戏自己弹（Pictionary 用 AlertModal），工具栏只透传 onClear，避免双弹窗
    props.onClear();
  };

  const selectedTool = TOOL_OPTIONS.find((option) => option.tool === props.tool);
  if (selectedTool === undefined) {
    throw new Error('[FAIL-FAST] Unknown drawing tool');
  }
  const panelTitle =
    activePanel === 'tool' ? '绘画工具' : activePanel === 'color' ? '画笔颜色' : '画笔粗细';

  // 颜色面板定位：legacy 浮层逻辑
  const isColorSheetCompact = width < COLOR_SHEET_BREAKPOINT;
  const colorPanelPosition = isColorSheetCompact
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: height - insets.top - spacing.medium,
        paddingBottom: Math.max(insets.bottom, spacing.medium),
      }
    : panelAnchor !== null
      ? {
          left: Math.max(
            spacing.small,
            Math.min(panelAnchor.left, width - COLOR_POPOVER_WIDTH - spacing.small),
          ),
          bottom: height - panelAnchor.top + spacing.small,
          width: COLOR_POPOVER_WIDTH,
          maxHeight: panelAnchor.top - insets.top - spacing.medium,
        }
      : null;

  return (
    <View style={styles.toolbar}>
      <ToolButton
        label={`选择工具，当前${selectedTool.label}`}
        caption={selectedTool.label}
        icon={selectedTool.icon}
        disabled={disabled}
        onPress={() => setActivePanel('tool')}
      />
      <View ref={buttonRef} collapsable={false} style={styles.colorButtonAnchor}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`选择颜色，当前${
            props.palette.find((s) => s.value.toUpperCase() === props.color.toUpperCase())?.name ??
            '自定义颜色'
          }`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => setActivePanel('color')}
          style={({ pressed }) => [
            styles.toolButton,
            disabled && styles.dimmed,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.colorDotLarge, { backgroundColor: props.color }]} />
          <Text style={styles.toolLabel}>颜色</Text>
        </Pressable>
      </View>
      <ToolButton
        label={`选择粗细，当前 ${props.strokeWidth} 像素`}
        caption="粗细"
        icon="ellipse"
        disabled={disabled}
        onPress={() => setActivePanel('width')}
      >
        <View
          style={[
            styles.widthDot,
            {
              width: props.strokeWidth,
              height: props.strokeWidth,
              backgroundColor: props.tool === 'eraser' ? colors.textMuted : props.color,
            },
          ]}
        />
      </ToolButton>
      <IconAction
        label="撤销"
        icon="arrow-undo-outline"
        disabled={disabled || !props.canUndo}
        onPress={props.onUndo}
      />
      {props.onRedo !== undefined && (
        <IconAction
          label="重做"
          icon="arrow-redo-outline"
          disabled={disabled || !props.canRedo}
          onPress={props.onRedo}
        />
      )}

      {/* 颜色面板：legacy 浮层定位（桌面端按钮旁浮层，移动端 bottom sheet） */}
      {activePanel === 'color' && colorPanelPosition !== null && (
        <Modal
          visible={!disabled}
          transparent
          animationType="none"
          onRequestClose={() => handleColorPanelClose()}
        >
          <View style={StyleSheet.absoluteFill}>
            <Pressable
              accessibilityLabel="关闭颜色面板"
              onPress={() => handleColorPanelClose()}
              style={StyleSheet.absoluteFill}
            />
            <View
              accessibilityLabel="画笔颜色面板"
              style={[styles.colorOptions, colorPanelPosition]}
            >
              <View style={styles.colorHeader}>
                {isColorPickerVisible && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="返回常用颜色"
                    onPress={() => setIsColorPickerVisible(false)}
                    style={styles.colorOptionButton}
                  >
                    <Ionicons name="arrow-back" size={spacing.large} color={colors.text} />
                  </Pressable>
                )}
                <Text accessibilityRole="header" style={styles.colorTitle}>
                  {isColorPickerVisible ? '调色板' : '颜色'}
                </Text>
                <View
                  accessibilityLabel="当前颜色"
                  style={[styles.colorCurrent, { backgroundColor: props.color }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭选择面板"
                  onPress={() => handleColorPanelClose()}
                  style={styles.colorOptionButton}
                >
                  <Ionicons name="close" size={spacing.large} color={colors.textSecondary} />
                </Pressable>
              </View>
              {isColorPickerVisible ? (
                <ColorPickerPanel color={props.color} onColorChange={handleColorChange} />
              ) : (
                <View style={styles.colorPaletteBody}>
                  <View style={styles.swatchGrid}>
                    {props.palette.map((entry) => {
                      const isSelected = props.color.toUpperCase() === entry.value.toUpperCase();
                      return (
                        <Pressable
                          key={entry.value}
                          accessibilityRole="button"
                          accessibilityLabel={`颜色${entry.name}`}
                          accessibilityState={{ selected: isSelected }}
                          testID={`drawing-toolbar-color-${entry.name}`}
                          onPress={() => {
                            handleColorChange(entry.value);
                            handleColorPanelClose();
                          }}
                          style={[styles.swatch, { backgroundColor: entry.value }]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={spacing.large}
                              color={
                                colorKit.isDark(entry.value) ? colors.textInverse : colors.text
                              }
                            />
                          )}
                        </Pressable>
                      );
                    })}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="自定义颜色"
                      testID="drawing-toolbar-custom-color"
                      onPress={() => setIsColorPickerVisible(true)}
                      style={styles.customColorButton}
                    >
                      <LinearGradient
                        colors={[
                          props.palette[0]?.value ?? colors.primary,
                          props.palette[1]?.value ?? colors.primary,
                          props.palette[2]?.value ?? colors.primary,
                          props.palette[3]?.value ?? colors.primary,
                          props.palette[4]?.value ?? colors.primary,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.customColorGradient}
                      >
                        <Ionicons name="add" size={spacing.large} color={colors.textInverse} />
                      </LinearGradient>
                    </Pressable>
                  </View>
                  {recentColors.length > 0 && (
                    <>
                      <Text style={styles.panelSectionTitle}>最近使用</Text>
                      <View style={styles.swatchGrid}>
                        {recentColors.map((recent, index) => (
                          <Pressable
                            key={`${recent}-${index}`}
                            accessibilityRole="button"
                            accessibilityLabel={`最近颜色 ${index + 1}`}
                            onPress={() => {
                              handleColorChange(recent);
                              handleColorPanelClose();
                            }}
                            style={[styles.swatch, { backgroundColor: recent }]}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* 工具/粗细面板：legacy 居中弹窗 */}
      {activePanel !== null && activePanel !== 'color' && (
        <Modal
          visible={!disabled}
          transparent
          animationType="none"
          onRequestClose={() => setActivePanel(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}>
            <View style={[styles.modalSheet, isCompact ? styles.sheetBottom : styles.sheetCenter]}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{panelTitle}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭选择面板"
                  onPress={() => setActivePanel(null)}
                  style={styles.sheetClose}
                >
                  <Ionicons
                    name="close"
                    size={componentSizes.icon.md}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {activePanel === 'tool' && (
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={styles.panelScrollContent}
                >
                  <View style={styles.optionGrid}>
                    {TOOL_OPTIONS.map((option) => (
                      <View key={option.tool} style={styles.toolOption}>
                        <ToolButton
                          label={option.label}
                          caption={option.label}
                          icon={option.icon}
                          isSelected={props.tool === option.tool}
                          disabled={disabled}
                          onPress={() => {
                            props.onToolChange(option.tool);
                            setActivePanel(null);
                          }}
                        />
                      </View>
                    ))}
                    <View style={styles.toolOption}>
                      <ToolButton
                        label="清空画布"
                        caption="清空"
                        icon="trash-outline"
                        disabled={disabled || !props.canUndo}
                        onPress={() => {
                          setActivePanel(null);
                          confirmClear();
                        }}
                      />
                    </View>
                  </View>
                </ScrollView>
              )}

              {activePanel === 'width' && (
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={styles.panelScrollContent}
                >
                  <View style={styles.optionGrid}>
                    {props.widths.map((w) => (
                      <Pressable
                        key={w}
                        accessibilityRole="button"
                        accessibilityLabel={`笔宽 ${w}`}
                        accessibilityState={{ selected: props.strokeWidth === w }}
                        testID={`drawing-toolbar-width-${w}`}
                        disabled={disabled}
                        onPress={() => {
                          props.onWidthChange(w);
                          setActivePanel(null);
                        }}
                        style={[
                          styles.widthOption,
                          props.strokeWidth === w && styles.selectedWidthOption,
                        ]}
                      >
                        <View
                          style={[
                            styles.widthDot,
                            {
                              width: w,
                              height: w,
                              backgroundColor:
                                props.tool === 'eraser' ? colors.textMuted : props.color,
                            },
                          ]}
                        />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    gap: spacing.tight,
    borderTopWidth: fixed.borderWidth,
    borderBottomWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  toolButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.transparent,
    paddingHorizontal: spacing.tight,
    gap: spacing.tight,
    height: fixed.minTouchTarget + spacing.medium,
    maxHeight: fixed.minTouchTarget + spacing.medium,
  },
  selectedToolButton: {
    backgroundColor: withAlpha(colors.primary, 0.15),
    borderColor: colors.primary,
  },
  pressed: {
    opacity: fixed.activeOpacity,
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    minWidth: fixed.minTouchTarget,
    padding: spacing.tight,
    backgroundColor: colors.text,
    borderRadius: borderRadius.small,
    zIndex: 1,
  },
  tooltipText: {
    ...textStyles.caption,
    color: colors.textInverse,
    textAlign: 'center',
  },
  toolLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  dimmed: {
    opacity: fixed.disabledOpacity,
  },
  dimmedText: {
    color: colors.textMuted,
  },
  colorDotLarge: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  colorButtonAnchor: { flex: 1 },
  colorOptions: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    gap: spacing.small,
    ...shadows.sm,
  },
  colorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  colorTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
    flex: 1,
  },
  colorCurrent: {
    width: spacing.large,
    height: spacing.large,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  colorOptionButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPaletteBody: {
    gap: spacing.small,
  },
  customColorButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  customColorGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthDot: {
    borderRadius: borderRadius.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(colors.text, 0.5),
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    padding: spacing.medium,
    gap: spacing.small,
    maxHeight: '70%',
  },
  sheetBottom: {
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheetCenter: {
    marginHorizontal: spacing.large,
    marginVertical: 'auto',
    borderRadius: borderRadius.large,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  sheetClose: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSectionTitle: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
  },
  colorPickerArea: { height: 240, flexShrink: 1 },
  colorPicker: { gap: spacing.small },
  colorPanel: {
    width: '100%',
    height: 144,
    borderRadius: borderRadius.small,
  },
  hueSlider: {
    borderRadius: borderRadius.small,
  },
  colorPreview: {
    width: '100%',
    height: spacing.large,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  swatch: {
    width: spacing.xlarge,
    height: spacing.xlarge,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  panelScroll: {
    maxHeight: 300,
  },
  panelScrollContent: {
    flexGrow: 1,
  },
  toolOption: {
    width: fixed.minTouchTarget,
  },
  widthOption: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  selectedWidthOption: {
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
  },
});

/**
 * 共用画画工具栏：Pictionary 与你画我猜共用，防 drift。
 *
 * 紧凑模式：工具 / 颜色 / 粗细 / 撤销 / 重做（可选）/ 清空。
 * 点开弹出面板；颜色面板含 HSV 调色板 + 预设色 + 最近使用。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ColorPicker, {
  type ColorFormatsObject,
  HueSlider,
  Panel1,
  Preview,
} from 'reanimated-color-picker';

import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

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

const RECENT_COLOR_COUNT = 8;
const WIDE_BREAKPOINT = 768;

type ToolbarPanel = 'tool' | 'color' | 'width';

function ToolButton({
  label,
  caption,
  icon,
  disabled,
  onPress,
  children,
}: {
  readonly label: string;
  readonly caption: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children?: React.ReactNode;
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
      <Ionicons name={icon} size={componentSizes.icon.md} color={colors.text} />
      <Text style={styles.toolLabel}>{caption}</Text>
      {children}
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
    onColorChange(hex);
  };
  return (
    <ColorPicker value={color} onCompleteJS={handleComplete} boundedThumb style={styles.pickerGap}>
      <Panel1 style={styles.colorPanel} />
      <HueSlider style={styles.hueSlider} />
      <Preview hideText style={styles.colorPreviewLarge} />
    </ColorPicker>
  );
}

export const DrawingToolbar: React.FC<SharedDrawingToolbarProps> = (props) => {
  const [activePanel, setActivePanel] = useState<ToolbarPanel | null>(null);
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);
  const { width } = useWindowDimensions();
  const isCompact = width < WIDE_BREAKPOINT;
  const { disabled } = props;

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
    rememberColor(hex);
    props.onColorChange(hex);
  };

  const confirmClear = () => {
    if (disabled) return;
    showConfirmAlert('清空画布', '确定要清空当前画作吗？此操作不可撤销。', props.onClear, {
      confirmText: '清空',
    });
  };

  const selectedTool = TOOL_OPTIONS.find((option) => option.tool === props.tool);
  const panelTitle =
    activePanel === 'tool' ? '绘画工具' : activePanel === 'color' ? '画笔颜色' : '画笔粗细';

  return (
    <View style={styles.toolbar}>
      <ToolButton
        label={`选择工具，当前${selectedTool?.label ?? ''}`}
        caption={selectedTool?.label ?? '工具'}
        icon={selectedTool?.icon ?? 'brush-outline'}
        disabled={disabled}
        onPress={() => setActivePanel('tool')}
      />
      <ToolButton
        label="选择颜色"
        caption="颜色"
        icon="color-palette-outline"
        disabled={disabled}
        onPress={() => setActivePanel('color')}
      >
        <View style={[styles.colorDot, { backgroundColor: props.color }]} />
      </ToolButton>
      <ToolButton
        label="选择粗细"
        caption="粗细"
        icon="ellipse"
        disabled={disabled}
        onPress={() => setActivePanel('width')}
      >
        <View
          style={[
            styles.widthDot,
            {
              width: Math.max(4, props.strokeWidth),
              height: Math.max(4, props.strokeWidth),
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
          disabled={disabled}
          onPress={props.onRedo}
        />
      )}
      <IconAction label="清空" icon="trash-outline" disabled={disabled} onPress={confirmClear} />

      <Modal
        visible={activePanel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePanel(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}>
          <View style={[styles.modalSheet, isCompact ? styles.sheetBottom : styles.sheetCenter]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{panelTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭"
                onPress={() => setActivePanel(null)}
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
              </Pressable>
            </View>

            {activePanel === 'tool' && (
              <View style={styles.optionGrid}>
                {TOOL_OPTIONS.map((option) => (
                  <View key={option.tool} style={styles.toolOption}>
                    <ToolButton
                      label={option.label}
                      caption={option.label}
                      icon={option.icon}
                      disabled={disabled}
                      onPress={() => {
                        props.onToolChange(option.tool);
                        setActivePanel(null);
                      }}
                    />
                  </View>
                ))}
              </View>
            )}

            {activePanel === 'color' && (
              <View style={styles.panelBody}>
                <ColorPickerPanel color={props.color} onColorChange={handleColorChange} />
                <Text style={styles.panelSectionTitle}>预设颜色</Text>
                <View style={styles.swatchGrid}>
                  {props.palette.map((entry) => (
                    <Pressable
                      key={entry.value}
                      accessibilityRole="button"
                      accessibilityLabel={`颜色${entry.name}`}
                      accessibilityState={{
                        selected: props.color.toUpperCase() === entry.value.toUpperCase(),
                      }}
                      onPress={() => {
                        handleColorChange(entry.value);
                        setActivePanel(null);
                      }}
                      style={[
                        styles.swatch,
                        { backgroundColor: entry.value },
                        props.color.toUpperCase() === entry.value.toUpperCase() &&
                          styles.selectedSwatch,
                      ]}
                    />
                  ))}
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
                            setActivePanel(null);
                          }}
                          style={[styles.swatch, { backgroundColor: recent }]}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {activePanel === 'width' && (
              <View style={styles.optionGrid}>
                {props.widths.map((w) => (
                  <Pressable
                    key={w}
                    accessibilityRole="button"
                    accessibilityLabel={`笔宽 ${w}`}
                    accessibilityState={{ selected: props.strokeWidth === w }}
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
                          width: Math.max(4, w),
                          height: Math.max(4, w),
                          backgroundColor: props.tool === 'eraser' ? colors.textMuted : props.color,
                        },
                      ]}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: spacing.tight,
    gap: spacing.tight,
  },
  toolButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.tight,
    gap: spacing.tight / 2,
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
  colorDot: {
    width: componentSizes.icon.sm,
    height: componentSizes.icon.sm,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  widthDot: {
    borderRadius: borderRadius.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  panelBody: {
    gap: spacing.small,
  },
  panelSectionTitle: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
  },
  pickerGap: {
    gap: spacing.small,
  },
  colorPanel: {
    height: 160,
    borderRadius: borderRadius.small,
  },
  hueSlider: {
    height: componentSizes.icon.md,
  },
  colorPreviewLarge: {
    height: spacing.large,
    borderRadius: borderRadius.small,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  swatch: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  selectedSwatch: {
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primary,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  toolOption: {
    width: '30%',
  },
  widthOption: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    padding: spacing.small,
  },
  selectedWidthOption: {
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
  },
});

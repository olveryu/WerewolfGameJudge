/**
 * 画手工具栏：工具、色板、笔宽、撤销、清空（清空二次确认）。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import {
  DRAWGUESS_DRAWING_PALETTE,
  DRAWGUESS_DRAWING_WIDTHS,
  type DrawGuessDrawingColor,
  type DrawGuessDrawingTool,
  type DrawGuessDrawingWidth,
  isDrawGuessDrawingColor,
} from '../../model/drawGuessDrawing';

export interface DrawGuessToolbarProps {
  readonly tool: DrawGuessDrawingTool;
  readonly color: DrawGuessDrawingColor;
  readonly strokeWidth: DrawGuessDrawingWidth;
  readonly canUndo: boolean;
  readonly disabled: boolean;
  readonly onToolChange: (tool: DrawGuessDrawingTool) => void;
  readonly onColorChange: (color: DrawGuessDrawingColor) => void;
  readonly onWidthChange: (width: DrawGuessDrawingWidth) => void;
  readonly onUndo: () => void;
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
  readonly tool: DrawGuessDrawingTool;
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
}[];

const WIDTH_LABELS: Record<DrawGuessDrawingWidth, string> = {
  [DRAWGUESS_DRAWING_WIDTHS[0]]: '细',
  [DRAWGUESS_DRAWING_WIDTHS[1]]: '中',
  [DRAWGUESS_DRAWING_WIDTHS[2]]: '粗',
};

function ToolButton({
  label,
  icon,
  isSelected,
  disabled,
  onPress,
}: {
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.toolButton,
        isSelected && styles.selectedToolButton,
        disabled && styles.dimmed,
      ]}
    >
      <Ionicons
        name={icon}
        size={componentSizes.icon.md}
        color={isSelected ? colors.primary : colors.text}
      />
      <Text style={[styles.toolLabel, isSelected && styles.selectedToolLabel]}>{label}</Text>
    </Pressable>
  );
}

/** 单行工具栏：图标 ≥44px 点击区域，色板提供颜色名称。 */
export const DrawGuessToolbar: React.FC<DrawGuessToolbarProps> = ({
  tool,
  color,
  strokeWidth,
  canUndo,
  disabled,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onClear,
}) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const confirmClear = () => {
    if (disabled) return;
    showConfirmAlert('清空画布', '确定要清空当前画作吗？此操作不可撤销。', onClear, {
      confirmText: '清空',
    });
  };
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {TOOL_OPTIONS.map((option) => (
          <ToolButton
            key={option.tool}
            label={option.label}
            icon={option.icon}
            isSelected={tool === option.tool}
            disabled={disabled}
            onPress={() => onToolChange(option.tool)}
          />
        ))}
        <ToolButton
          label="撤销"
          icon="arrow-undo-outline"
          isSelected={false}
          disabled={disabled || !canUndo}
          onPress={onUndo}
        />
        <ToolButton
          label="清空"
          icon="trash-outline"
          isSelected={false}
          disabled={disabled}
          onPress={confirmClear}
        />
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`当前颜色，${DRAWGUESS_DRAWING_PALETTE.find((entry) => entry.value.toUpperCase() === color.toUpperCase())?.name ?? '自定义'}，点击展开色板`}
          disabled={disabled}
          onPress={() => setPaletteOpen((open) => !open)}
          style={[styles.colorPreview, disabled && styles.dimmed]}
        >
          <View style={[styles.colorDot, { backgroundColor: color }]} />
          <Text style={styles.toolLabel}>颜色</Text>
        </Pressable>
        {DRAWGUESS_DRAWING_WIDTHS.map((width) => (
          <Pressable
            key={width}
            accessibilityRole="button"
            accessibilityLabel={`笔宽${WIDTH_LABELS[width]}`}
            accessibilityState={{ selected: strokeWidth === width, disabled }}
            disabled={disabled}
            onPress={() => onWidthChange(width)}
            style={[
              styles.widthButton,
              strokeWidth === width && styles.selectedToolButton,
              disabled && styles.dimmed,
            ]}
          >
            <View
              style={[
                styles.widthDot,
                {
                  width: Math.max(componentSizes.badge.dot, width / 2),
                  height: Math.max(componentSizes.badge.dot, width / 2),
                  backgroundColor: strokeWidth === width ? colors.primary : colors.text,
                },
              ]}
            />
            <Text style={[styles.toolLabel, strokeWidth === width && styles.selectedToolLabel]}>
              {WIDTH_LABELS[width]}
            </Text>
          </Pressable>
        ))}
      </View>
      {paletteOpen && !disabled && (
        <View style={styles.palette} accessibilityLabel="颜色选择">
          {DRAWGUESS_DRAWING_PALETTE.map((entry) => {
            if (!isDrawGuessDrawingColor(entry.value)) {
              throw new Error('[FAIL-FAST] DrawGuess palette color is invalid');
            }
            const paletteColor = entry.value;
            const isSelected = color.toUpperCase() === paletteColor.toUpperCase();
            return (
              <Pressable
                key={paletteColor}
                accessibilityRole="button"
                accessibilityLabel={`颜色${entry.name}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onColorChange(paletteColor);
                  setPaletteOpen(false);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: paletteColor },
                  isSelected && styles.selectedSwatch,
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.small,
    gap: spacing.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  selectedToolButton: {
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
  },
  toolLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  selectedToolLabel: {
    color: colors.primary,
  },
  dimmed: {
    opacity: fixed.disabledOpacity,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: fixed.minTouchTarget,
    gap: spacing.tight,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.small,
  },
  colorDot: {
    width: componentSizes.icon.md,
    height: componentSizes.icon.md,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  widthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: fixed.minTouchTarget,
    gap: spacing.tight,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.small,
  },
  widthDot: {
    borderRadius: borderRadius.full,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
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
});

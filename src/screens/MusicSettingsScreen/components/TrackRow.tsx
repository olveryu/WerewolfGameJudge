/**
 * TrackRow — 单首 BGM 曲目行
 *
 * 展示曲名 + 中文副标题 + 氛围标签 + radio 选中态 + play/stop 按钮。
 * 点击行体选择曲目，点击播放按钮试听。两个操作独立。
 * 纯 Presentational 组件：props 回调上报 intent，不 import service。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import {
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import type { BgmTrackEntry } from '@/services/infra/audio/audioRegistry';
import {
  borderRadius,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import { EqualizerBars } from './EqualizerBars';

interface TrackRowProps {
  track: BgmTrackEntry;
  isSelected: boolean;
  isPreviewing: boolean;
  disabled: boolean;
  onSelect: (trackId: string) => void;
  onPreviewToggle: (trackId: string) => void;
  colors: ThemeColors;
}

export const TrackRow = memo<TrackRowProps>(function TrackRow({
  track,
  isSelected,
  isPreviewing,
  disabled,
  onSelect,
  onPreviewToggle,
  colors,
}) {
  const s = getStyles(colors);

  return (
    <TouchableOpacity
      style={[
        s.container,
        isSelected && {
          backgroundColor: withAlpha(colors.primary, 0.1),
          borderColor: colors.primary,
        },
      ]}
      onPress={() => onSelect(track.id)}
      activeOpacity={fixed.activeOpacity}
      disabled={disabled}
    >
      {/* Radio indicator */}
      <View style={[s.radio, isSelected && { borderColor: colors.primary }]}>
        {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
      </View>

      {/* Track info */}
      <View style={s.info}>
        <Text style={[s.label, isSelected && { color: colors.primary }]} numberOfLines={1}>
          {track.label}
        </Text>
        <View style={s.metaRow}>
          <Text style={s.subtitle} numberOfLines={1}>
            {track.subtitle}
          </Text>
          <View style={[s.moodTag, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
            <Text style={[s.moodText, { color: colors.primary }]}>{track.mood}</Text>
          </View>
        </View>
      </View>

      {/* Equalizer (visible when previewing) */}
      {isPreviewing && <EqualizerBars active colors={colors} />}

      {/* Play / Stop button */}
      <TouchableOpacity
        onPress={() => onPreviewToggle(track.id)}
        hitSlop={{
          top: spacing.small,
          bottom: spacing.small,
          left: spacing.small,
          right: spacing.small,
        }}
        activeOpacity={fixed.activeOpacity}
        disabled={disabled}
      >
        <Ionicons
          name={isPreviewing ? 'stop-circle' : 'play-circle'}
          size={componentSizes.icon.lg}
          color={isPreviewing ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

interface TrackRowStyles {
  container: ViewStyle;
  radio: ViewStyle;
  radioDot: ViewStyle;
  info: ViewStyle;
  label: TextStyle;
  metaRow: ViewStyle;
  subtitle: TextStyle;
  moodTag: ViewStyle;
  moodText: TextStyle;
}

function getStyles(colors: ThemeColors): TrackRowStyles {
  return StyleSheet.create<TrackRowStyles>({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      marginBottom: spacing.tight,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    radio: {
      width: spacing.large,
      height: spacing.large,
      borderRadius: spacing.large / 2,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioDot: {
      width: spacing.small,
      height: spacing.small,
      borderRadius: spacing.small / 2,
    },
    info: {
      flex: 1,
      gap: spacing.micro,
    },
    label: {
      ...textStyles.body,
      color: colors.text,
      fontWeight: typography.weights.medium,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    subtitle: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    moodTag: {
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.small,
    },
    moodText: {
      ...textStyles.captionSmall,
      fontWeight: typography.weights.medium,
    },
  });
}

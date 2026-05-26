/**
 * NowPlayingBar — mini playback bar shown while previewing
 *
 * Shows the previewing track name + equalizer animation + stop button.
 * Only renders when a track is being previewed.
 * Pure presentational component; does not import services.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import {
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import { EqualizerBars } from './EqualizerBars';

interface NowPlayingBarProps {
  trackLabel: string;
  onStop: () => void;
  colors: ThemeColors;
}

/** Now-playing track bar. */
export const NowPlayingBar = memo<NowPlayingBarProps>(function NowPlayingBar({
  trackLabel,
  onStop,
}) {
  const s = getStyles(colors);

  return (
    <View style={s.container}>
      <EqualizerBars active colors={colors} />
      <Text style={s.label} numberOfLines={1}>
        {trackLabel}
      </Text>
      <TouchableOpacity
        onPress={onStop}
        hitSlop={{
          top: spacing.small,
          bottom: spacing.small,
          left: spacing.small,
          right: spacing.small,
        }}
        activeOpacity={fixed.activeOpacity}
      >
        <Ionicons name="stop-circle" size={componentSizes.icon.lg} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

interface NowPlayingBarStyles {
  container: ViewStyle;
  label: TextStyle;
}

function getStyles(colors: ThemeColors): NowPlayingBarStyles {
  return StyleSheet.create<NowPlayingBarStyles>({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      marginTop: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    label: {
      flex: 1,
      ...textStyles.secondarySemibold,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
  });
}

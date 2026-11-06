/** Independent seat selection, public identity markers and progress; no game rules or actions. */

import { StyleSheet, Text, View } from 'react-native';

import type { RoomSeatIndicators } from '@/features/room/model/RoomSeatDataSource';
import { TESTIDS } from '@/testids';
import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';

type IndicatorStyles = ReturnType<typeof createRoomSeatIndicatorStyles>;

interface IndicatorProps {
  readonly seat: number;
  readonly indicators: RoomSeatIndicators;
  readonly styles: IndicatorStyles;
}

/** Public identity text is always readable inside the avatar, without extra touch targets. */
export function RoomSeatMarkers({ seat, indicators, styles }: IndicatorProps) {
  if (indicators.markers.length === 0) return null;
  return (
    <View pointerEvents="none" style={styles.markerLayer}>
      {indicators.markers.map((marker) => (
        <Text
          key={marker.key}
          accessibilityLabel={marker.label}
          style={[
            styles.markerLabel,
            marker.tone === 'warning' ? styles.markerWarning : styles.markerInfo,
          ]}
          testID={TESTIDS.seatMarker(seat, marker.key)}
        >
          {marker.label}
        </Text>
      ))}
    </View>
  );
}

/** Team and action status use only the space required by their visible text. */
export function RoomSeatProgress({ seat, indicators, styles }: IndicatorProps) {
  if (indicators.selection === null && indicators.progressLabel === null) return null;
  return (
    <View style={styles.progressRows} testID={TESTIDS.seatProgress(seat)}>
      {indicators.selection !== null && (
        <Text style={styles.selectionLabel} numberOfLines={1}>
          {indicators.selection.label}
        </Text>
      )}
      {indicators.progressLabel !== null && (
        <Text style={styles.progressLabel} numberOfLines={1}>
          {indicators.progressLabel}
        </Text>
      )}
    </View>
  );
}

/** Created once by the board's shared tile-style factory. */
export function createRoomSeatIndicatorStyles(colors: ThemeColors, tileSize: number) {
  return StyleSheet.create({
    markerLayer: {
      position: 'absolute',
      bottom: spacing.tight + spacing.micro,
      left: spacing.tight + spacing.micro,
      right: spacing.tight + spacing.micro,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.micro,
    },
    markerLabel: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      textAlign: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.micro,
    },
    markerWarning: { color: colors.warning },
    markerInfo: { color: colors.info },
    progressRows: {
      width: tileSize - spacing.tight,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: spacing.micro,
    },
    selectionLabel: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.success,
      textAlign: 'center',
    },
    progressLabel: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}

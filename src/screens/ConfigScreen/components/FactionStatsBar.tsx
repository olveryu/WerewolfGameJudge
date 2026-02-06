/**
 * FactionStatsBar - Shows faction counts with colored indicators
 *
 * Displays wolf/good/neutral counts and warns if wolves >= good players.
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface FactionStats {
  wolfCount: number;
  goodCount: number;
  neutralCount: number;
  total: number;
}

export interface FactionStatsBarProps {
  stats: FactionStats;
  styles: ConfigScreenStyles;
  wolfColor: string;
  goodColor: string;
  neutralColor: string;
  warningColor: string;
}

const arePropsEqual = (prev: FactionStatsBarProps, next: FactionStatsBarProps): boolean => {
  return (
    prev.stats.wolfCount === next.stats.wolfCount &&
    prev.stats.goodCount === next.stats.goodCount &&
    prev.stats.neutralCount === next.stats.neutralCount &&
    prev.stats.total === next.stats.total &&
    prev.styles === next.styles
  );
};

export const FactionStatsBar = memo<FactionStatsBarProps>(
  ({ stats, styles, wolfColor, goodColor, neutralColor, warningColor }) => {
    const isImbalanced = stats.wolfCount >= stats.goodCount && stats.wolfCount > 0;

    return (
      <View style={styles.statsBar}>
        <View style={styles.statsSegment}>
          <Text style={[styles.statsSegmentDot, { color: wolfColor }]}>●</Text>
          <Text style={styles.statsSegmentText}>🐺 {stats.wolfCount}</Text>
        </View>

        <View style={styles.statsDivider} />

        <View style={styles.statsSegment}>
          <Text style={[styles.statsSegmentDot, { color: goodColor }]}>●</Text>
          <Text style={styles.statsSegmentText}>👥 {stats.goodCount}</Text>
        </View>

        {stats.neutralCount > 0 && (
          <>
            <View style={styles.statsDivider} />
            <View style={styles.statsSegment}>
              <Text style={[styles.statsSegmentDot, { color: neutralColor }]}>●</Text>
              <Text style={styles.statsSegmentText}>⚖️ {stats.neutralCount}</Text>
            </View>
          </>
        )}

        <View style={styles.statsDivider} />

        <Text style={styles.statsSegmentText}>合计 {stats.total}人</Text>

        {isImbalanced && (
          <>
            <View style={styles.statsFlexSpacer} />
            <View style={styles.statsWarning}>
              <Text style={[styles.statsWarningText, { color: warningColor }]}>⚠️ 狼多于好人</Text>
            </View>
          </>
        )}
      </View>
    );
  },
  arePropsEqual,
);

FactionStatsBar.displayName = 'FactionStatsBar';

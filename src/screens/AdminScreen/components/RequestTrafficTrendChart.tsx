/** Responsive HTTP request trend chart with no data fetching or state writes. */

import type React from 'react';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { AdminRequestTraffic } from '@/features/admin/model/adminContracts';
import { colors, componentSizes, spacing, typography } from '@/theme';

type TrafficPoint = AdminRequestTraffic['http']['series'][number];

interface RequestTrafficTrendChartProps {
  points: readonly TrafficPoint[];
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 100;
const CHART_PADDING = 8;
const CHART_STROKE_WIDTH = 2;

function formatTimeLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RequestTrafficTrendChartComponent: React.FC<RequestTrafficTrendChartProps> = ({ points }) => {
  const chartPoints = useMemo(() => {
    const maxCount = Math.max(1, ...points.map((point) => point.count));
    const drawableWidth = CHART_WIDTH - CHART_PADDING * 2;
    const drawableHeight = CHART_HEIGHT - CHART_PADDING * 2;
    const denominator = Math.max(1, points.length - 1);
    return points.map((point, index) => ({
      x: CHART_PADDING + (index / denominator) * drawableWidth,
      y: CHART_HEIGHT - CHART_PADDING - (point.count / maxCount) * drawableHeight,
    }));
  }, [points]);

  if (points.length === 0) return null;
  const firstPoint = chartPoints[0]!;
  const lastPoint = chartPoints[chartPoints.length - 1]!;
  const firstTrafficPoint = points[0]!;
  const lastTrafficPoint = points[points.length - 1]!;
  const polylinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel={`HTTP 请求趋势，共 ${points.length} 个时间桶`}
    >
      <Text style={styles.title}>HTTP 请求趋势</Text>
      <View style={styles.chart}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
          <Line
            x1={CHART_PADDING}
            y1={CHART_HEIGHT - CHART_PADDING}
            x2={CHART_WIDTH - CHART_PADDING}
            y2={CHART_HEIGHT - CHART_PADDING}
            stroke={colors.borderLight}
            strokeWidth={CHART_STROKE_WIDTH}
          />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.info}
            strokeWidth={CHART_STROKE_WIDTH}
          />
          <Circle cx={firstPoint.x} cy={firstPoint.y} r={CHART_STROKE_WIDTH} fill={colors.info} />
          <Circle cx={lastPoint.x} cy={lastPoint.y} r={CHART_STROKE_WIDTH} fill={colors.info} />
        </Svg>
      </View>
      <View style={styles.labels}>
        <Text style={styles.timeLabel}>{formatTimeLabel(firstTrafficPoint.timestamp)}</Text>
        <Text style={styles.timeLabel}>{formatTimeLabel(lastTrafficPoint.timestamp)}</Text>
      </View>
    </View>
  );
};

/** HTTP request trend chart. */
export const RequestTrafficTrendChart = memo(RequestTrafficTrendChartComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.large,
  },
  title: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.small,
  },
  chart: {
    width: '100%',
    height: componentSizes.avatar.xl + spacing.large,
    backgroundColor: colors.surface,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.tight,
  },
  timeLabel: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
  },
});

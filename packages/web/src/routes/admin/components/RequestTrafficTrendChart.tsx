import './AdminComponents.css';

import type { AdminRequestTraffic } from '@/features/admin/model/adminContracts';

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

/** Responsive HTTP request trend line (SVG); pure rendering, no fetching. */
export function RequestTrafficTrendChart({ points }: RequestTrafficTrendChartProps) {
  const firstTrafficPoint = points[0];
  const lastTrafficPoint = points.at(-1);
  if (firstTrafficPoint === undefined || lastTrafficPoint === undefined) return null;

  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const drawableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const denominator = Math.max(1, points.length - 1);
  const chartPoints = points.map((point, index) => ({
    x: CHART_PADDING + (index / denominator) * drawableWidth,
    y: CHART_HEIGHT - CHART_PADDING - (point.count / maxCount) * drawableHeight,
  }));
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints.at(-1);
  if (firstPoint === undefined || lastPoint === undefined) {
    throw new Error('[FAIL-FAST] Trend chart points must match the traffic series');
  }
  const polylinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div
      className="admin-trend"
      role="img"
      aria-label={`HTTP 请求趋势，共 ${points.length} 个时间桶`}
    >
      <h2 className="admin-section-title">HTTP 请求趋势</h2>
      <div className="admin-trend-chart">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} aria-hidden>
          <line
            className="admin-trend-axis"
            x1={CHART_PADDING}
            y1={CHART_HEIGHT - CHART_PADDING}
            x2={CHART_WIDTH - CHART_PADDING}
            y2={CHART_HEIGHT - CHART_PADDING}
            strokeWidth={CHART_STROKE_WIDTH}
          />
          <polyline
            className="admin-trend-line"
            points={polylinePoints}
            strokeWidth={CHART_STROKE_WIDTH}
          />
          <circle
            className="admin-trend-dot"
            cx={firstPoint.x}
            cy={firstPoint.y}
            r={CHART_STROKE_WIDTH}
          />
          <circle
            className="admin-trend-dot"
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={CHART_STROKE_WIDTH}
          />
        </svg>
      </div>
      <div className="admin-trend-labels">
        <span>{formatTimeLabel(firstTrafficPoint.timestamp)}</span>
        <span>{formatTimeLabel(lastTrafficPoint.timestamp)}</span>
      </div>
    </div>
  );
}

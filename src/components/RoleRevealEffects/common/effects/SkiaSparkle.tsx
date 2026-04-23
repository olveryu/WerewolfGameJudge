/**
 * SkiaSparkle — 共享十字闪烁星形组件（SVG）
 *
 * 渲染一个 ✦ 形 sparkle：中心亮点 + 十字 Line spike + 可选对角 spike（8 芒）+ 柔光晕。
 * 不含动画驱动——由外层 Animated opacity / transform 控制。
 * 不 import service，不含业务逻辑。
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Line } from 'react-native-svg';

interface SkiaSparkleProps {
  /** Center X */
  x: number;
  /** Center Y */
  y: number;
  /** Base radius — controls spike lengths proportionally */
  r: number;
  /** Spike / dot color */
  color: string;
  /** Glow halo color (defaults to `color`) */
  glowColor?: string;
  /** Whether to render 8-pointed (with diagonal spikes). Default: false */
  bright?: boolean;
  /** Blur radius for glow halo. Default: 4 */
  glowBlur?: number;
  /** Stroke width multiplier for main spikes. Default: 1 */
  strokeScale?: number;
  /** SVG viewport width. Auto-computed if omitted. */
  width?: number;
  /** SVG viewport height. Auto-computed if omitted. */
  height?: number;
}

/**
 * Pure SVG sparkle shape — no hooks, no animation.
 * Wrap in an `<Animated.View style={{ opacity }}>` for animated opacity.
 */
export const SkiaSparkle: React.FC<SkiaSparkleProps> = React.memo(
  ({ x, y, r, color, glowColor, bright = false, glowBlur = 4, strokeScale = 1, width, height }) => {
    const gc = glowColor ?? color;
    const vLen = r * 3.5;
    const hLen = r * 2.5;
    const dLen = r * 2;
    const sw = (bright ? 1.2 : 0.8) * strokeScale;

    // Ensure SVG viewport is large enough to contain the glow halo
    const glowR = r * 4;
    const svgW = width ?? x + glowR + glowBlur * 2;
    const svgH = height ?? y + vLen + glowBlur * 2;
    const filterId = `sparkle-glow-${x}-${y}`;

    return (
      <Svg width={svgW} height={svgH} style={styles.absolute}>
        <Defs>
          <Filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation={glowBlur} />
          </Filter>
        </Defs>
        <G>
          {/* Soft glow halo */}
          <Circle cx={x} cy={y} r={glowR} fill={gc} filter={`url(#${filterId})`} />
          {/* Vertical spike */}
          <Line
            x1={x}
            y1={y - vLen}
            x2={x}
            y2={y + vLen}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Horizontal spike */}
          <Line
            x1={x - hLen}
            y1={y}
            x2={x + hLen}
            y2={y}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Diagonal spikes for 8-pointed ✦ */}
          {bright && (
            <>
              <Line
                x1={x - dLen}
                y1={y - dLen}
                x2={x + dLen}
                y2={y + dLen}
                stroke={color}
                strokeWidth={sw * 0.6}
                strokeLinecap="round"
              />
              <Line
                x1={x + dLen}
                y1={y - dLen}
                x2={x - dLen}
                y2={y + dLen}
                stroke={color}
                strokeWidth={sw * 0.6}
                strokeLinecap="round"
              />
            </>
          )}
          {/* Center bright dot */}
          <Circle cx={x} cy={y} r={r * 0.5} fill={color} />
        </G>
      </Svg>
    );
  },
);
SkiaSparkle.displayName = 'SkiaSparkle';

const styles = StyleSheet.create({
  absolute: { position: 'absolute', left: 0, top: 0 },
});

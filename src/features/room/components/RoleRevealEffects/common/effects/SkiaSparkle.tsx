/**
 * SkiaSparkle — shared cross-twinkle sparkle component (Skia)
 *
 * Renders a ✦-shaped sparkle: center bright dot + cross-Line spikes + optional diagonal spikes (8-pointed) + soft halo.
 * Has no animation driver — animation is controlled by the outer Group's opacity / transform.
 * Does not import services and contains no business logic.
 */
import { Blur, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import React from 'react';

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
}

/**
 * Pure Skia sparkle shape — no hooks, no animation.
 * Wrap in a `<Group opacity={...}>` for animated opacity.
 */
export const SkiaSparkle: React.FC<SkiaSparkleProps> = React.memo(
  ({ x, y, r, color, glowColor, bright = false, glowBlur = 4, strokeScale = 1 }) => {
    const gc = glowColor ?? color;
    const vLen = r * 3.5;
    const hLen = r * 2.5;
    const dLen = r * 2;
    const sw = (bright ? 1.2 : 0.8) * strokeScale;

    return (
      <Group>
        {/* Soft glow halo */}
        <Circle cx={x} cy={y} r={r * 4} color={gc}>
          <Blur blur={glowBlur} />
        </Circle>
        {/* Vertical spike */}
        <Line
          p1={vec(x, y - vLen)}
          p2={vec(x, y + vLen)}
          color={color}
          style="stroke"
          strokeWidth={sw}
          strokeCap="round"
        />
        {/* Horizontal spike */}
        <Line
          p1={vec(x - hLen, y)}
          p2={vec(x + hLen, y)}
          color={color}
          style="stroke"
          strokeWidth={sw}
          strokeCap="round"
        />
        {/* Diagonal spikes for 8-pointed ✦ */}
        {bright && (
          <>
            <Line
              p1={vec(x - dLen, y - dLen)}
              p2={vec(x + dLen, y + dLen)}
              color={color}
              style="stroke"
              strokeWidth={sw * 0.6}
              strokeCap="round"
            />
            <Line
              p1={vec(x + dLen, y - dLen)}
              p2={vec(x - dLen, y + dLen)}
              color={color}
              style="stroke"
              strokeWidth={sw * 0.6}
              strokeCap="round"
            />
          </>
        )}
        {/* Center bright dot */}
        <Circle cx={x} cy={y} r={r * 0.5} color={color} />
      </Group>
    );
  },
);
SkiaSparkle.displayName = 'SkiaSparkle';

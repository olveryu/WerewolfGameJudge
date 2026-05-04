/**
 * ScreenFlash — Skia 电影级全屏闪光特效
 *
 * 翻牌揭示后从卡片中心迸裂：径向冲击波 + 迸射粒子。
 * 使用 Skia Canvas + Blur + RadialGradient + blendMode="screen" 实现。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Paint,
  Picture,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

// Pre-compute burst particle data (radial scatter)
const BURST_PARTICLES = Array.from({ length: SK.burstParticleCount }, (_, i) => {
  const angle = (i / SK.burstParticleCount) * Math.PI * 2 + ((i * 7) % 10) * 0.06;
  const dist = 50 + ((i * 31) % 100) * 1.5;
  return { angle, dist, size: 1.5 + ((i * 13) % 20) / 10 };
});

// ── Immediate-mode Skia resources (reused across frames) ──
const burstRecorder = Skia.PictureRecorder();
const burstPaint = Skia.Paint();

interface ScreenFlashProps {
  /** Flash color (faction primary) */
  color: string;
  /** Peak opacity (per-alignment, from config) */
  peakOpacity: number;
  /** Flash duration (ms) */
  duration: number;
  /** Whether to animate */
  animate: boolean;
  /** Position: center X of the card in page coordinates */
  centerX: number;
  /** Position: center Y of the card in page coordinates */
  centerY: number;
  /** Per-alignment delay before flash fires (ms). */
  delay?: number;
}

export const ScreenFlash: React.FC<ScreenFlashProps> = ({
  color,
  peakOpacity,
  duration,
  animate,
  centerX,
  centerY,
  delay = 200,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(
      AE.effectStartDelay + delay,
      withSequence(
        withTiming(0.15, { duration: duration * 0.15, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: duration * 0.85, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [animate, progress, duration, delay]);

  // Radial shockwave
  const waveR = useDerivedValue(() => progress.value * screenW);
  const waveOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.15) return (p / 0.15) * peakOpacity;
    return Math.max(0, peakOpacity * (1 - (p - 0.15) / 0.85));
  });

  // ── Burst particles: Immediate Mode via Picture API ──
  // Replaces 20 BurstParticle components (80 useDerivedValue per frame) with 1.
  const burstPicture = useDerivedValue(() => {
    'worklet';
    const c = burstRecorder.beginRecording(Skia.XYWHRect(0, 0, screenW, screenH));
    const skColor = Skia.Color(color);
    const p = progress.value;
    for (let i = 0; i < BURST_PARTICLES.length; i++) {
      const bp = BURST_PARTICLES[i]!;
      const cx = centerX + Math.cos(bp.angle) * bp.dist * p;
      const cy = centerY + Math.sin(bp.angle) * bp.dist * p;
      const opacity = p < 0.05 ? p / 0.05 : Math.max(0, 1 - (p - 0.05) / 0.6);
      const r = bp.size * Math.max(0.3, 1 - p * 0.7);
      burstPaint.setColor(skColor);
      burstPaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, r, burstPaint);
    }
    return burstRecorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={styles.canvas}>
      {/* Radial shockwave — expanding glow from center */}
      <Group opacity={waveOpacity}>
        <Circle cx={centerX} cy={centerY} r={waveR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={screenW}
            colors={[color, `${color}80`, `${color}00`]}
          />
          <Blur blur={SK.flashBlur} />
        </Circle>
      </Group>

      {/* Burst particles — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={SK.particleBlur} />
          </Paint>
        }
      >
        <Picture picture={burstPicture} />
      </Group>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    pointerEvents: 'none',
  },
});

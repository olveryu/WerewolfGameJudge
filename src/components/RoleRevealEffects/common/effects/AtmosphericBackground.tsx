/**
 * AtmosphericBackground — Skia 环境粒子氛围层
 *
 * 在各揭示动画交互阶段提供低调的背景粒子/光晕运动感，
 * 增强沉浸感但不喧宾夺主。使用 Skia Canvas + Blur + blendMode="screen"。
 * 接受阵营主色，自动生成环境粒子。
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
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const AMBIENT_COUNT = 12;
const AMBIENT_PARTICLES = Array.from({ length: AMBIENT_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  return {
    xRatio: r1,
    yRatio: r2,
    size: 2 + r3 * 4,
    driftX: (r1 - 0.5) * 30,
    driftY: -15 - r2 * 25,
    phase: ((i * 83 + 11) % 628) / 100,
  };
});

// ── Immediate-mode Skia resources (reused across frames) ──
const particleRecorder = Skia.PictureRecorder();
const particlePaint = Skia.Paint();

interface AtmosphericBackgroundProps {
  /** Primary color for particles */
  color: string;
  /** Whether to animate */
  animate: boolean;
}

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({ color, animate }) => {
  const cycle = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    cycle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 8000, easing: Easing.linear }),
      -1,
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [animate, cycle, glowPulse]);

  const centerGlowOpacity = useDerivedValue(() => 0.06 + glowPulse.value * 0.04);

  // ── Particles: Immediate Mode via Picture API ──
  // Replaces 12 AmbientParticle components (36 useDerivedValue per frame) with 1.
  const particlePicture = useDerivedValue(() => {
    'worklet';
    const c = particleRecorder.beginRecording(Skia.XYWHRect(0, 0, SCREEN_W, SCREEN_H));
    const skColor = Skia.Color(color);
    for (let i = 0; i < AMBIENT_PARTICLES.length; i++) {
      const p = AMBIENT_PARTICLES[i];
      const baseX = p.xRatio * SCREEN_W;
      const baseY = p.yRatio * SCREEN_H;
      const cx = baseX + p.driftX * Math.sin(cycle.value + p.phase);
      const cy = baseY + p.driftY * Math.sin(cycle.value * 0.7 + p.phase);
      const opacity = 0.15 + 0.15 * Math.sin(cycle.value * 1.3 + p.phase);
      particlePaint.setColor(skColor);
      particlePaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, p.size, particlePaint);
    }
    return particleRecorder.finishRecordingAsPicture();
  });

  if (!animate) return null;

  return (
    <Canvas style={styles.fullScreen} pointerEvents="none">
      {/* Subtle center radial glow */}
      <Group opacity={centerGlowOpacity}>
        <Circle cx={SCREEN_W / 2} cy={SCREEN_H * 0.45} r={SCREEN_W * 0.6}>
          <RadialGradient
            c={vec(SCREEN_W / 2, SCREEN_H * 0.45)}
            r={SCREEN_W * 0.6}
            colors={[`${color}30`, `${color}00`]}
          />
          <Blur blur={30} />
        </Circle>
      </Group>

      {/* Floating ambient particles — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={3} />
          </Paint>
        }
      >
        <Picture picture={particlePicture} />
      </Group>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
});

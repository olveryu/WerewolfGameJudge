/**
 * RoleHunt - 瞄准镜狙击揭示动画（Skia + Reanimated 4 + Gesture Handler 2）
 *
 * 动画流程：森林夜景背景 → 动物角色从左右横穿屏幕 → 玩家拖动瞄准镜瞄准 →
 * 抬手/点击射击 → 命中非目标角色（烟雾消散）→ 命中目标角色时全屏庆祝 → 揭示角色卡。
 * 6 发子弹限制，弹尽自动揭晓。
 *
 * Skia Canvas 负责：
 *   - 预渲染森林背景（暮色天空 + 星星 + 月亮 + 山丘 + 树线 + 地面 + 草丛 + 雾 + 暗角）
 *   - 瞄准镜覆层（暗色遮罩 + 圆形亮区 + 红色十字准星 + mil-dot）
 *   - 萤火虫浮动光点
 *   - 射击命中爆发光线
 *
 * Reanimated 负责：动物横穿动画、子弹 HUD、庆祝粒子、卡牌揭示。
 * Gesture Handler 负责：瞄准镜拖动 + 射击触发。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line,
  Picture,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { CELEBRATION_EMOJIS } from '@/config/emojiTokens';
import { crossPlatformTextShadow, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────

const SCOPE_RADIUS = 45;
const HIT_RADIUS = 35;
const ANIMAL_SIZE = 60;
const GROUND_TOP_RATIO = 0.52;
const GROUND_BOTTOM_PADDING_RATIO = 0.16;
const SPAWN_INTERVAL_MS = 1200;
const TARGET_SPAWN_INTERVAL_MS = 3500;

/** Forest animal emojis — same roleId always maps to the same animal */
const HUNT_ANIMAL_EMOJIS = [
  '🐰',
  '🦌',
  '🐻',
  '🦊',
  '🐗',
  '🦝',
  '🐿️',
  '🦉',
  '🦔',
  '🐇',
  '🦡',
  '🐑',
  '🦢',
  '🕊️',
  '🐈‍⬛',
  '🐒',
] as const;

function roleIdToAnimalEmoji(roleId: string): string {
  let hash = 0;
  for (let i = 0; i < roleId.length; i++) {
    hash = (hash * 31 + roleId.charCodeAt(i)) | 0;
  }
  return HUNT_ANIMAL_EMOJIS[Math.abs(hash) % HUNT_ANIMAL_EMOJIS.length];
}

const SKY_COLORS = {
  top: '#0b1a2d',
  mid1: '#132844',
  mid2: '#1a3a3a',
  mid3: '#1a4428',
  bottom: '#0d2818',
} as const;

const SCOPE_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.55)',
  lensCenter: 'rgba(200, 230, 255, 0.06)',
  lensEdge: 'rgba(200, 230, 255, 0.03)',
  ring: 'rgba(180, 200, 220, 0.6)',
  outerRing: 'rgba(100, 130, 160, 0.3)',
  crosshair: 'rgba(255, 80, 80, 0.7)',
  centerDot: 'rgba(255, 80, 80, 0.8)',
  milDot: 'rgba(255, 80, 80, 0.5)',
  tick: 'rgba(180, 200, 220, 0.3)',
} as const;

const HUNT_COLORS = {
  hintText: 'rgba(255, 255, 255, 0.85)',
  animalName: '#ffffff',
  animalNameBg: 'rgba(0, 0, 0, 0.5)',
  hitFlash: 'rgba(100, 255, 150, 0.6)',
  burstRay: 'rgba(255, 255, 200, 0.8)',
  shockwave: 'rgba(200, 230, 255, 0.6)',
  firefly: [
    'rgba(180, 220, 255, 0.6)',
    'rgba(150, 200, 255, 0.5)',
    'rgba(200, 230, 255, 0.7)',
    'rgba(100, 180, 255, 0.5)',
    'rgba(180, 255, 220, 0.4)',
  ] as const,
} as const;

// ─── Extended props ─────────────────────────────────────────────────────
interface RoleHuntProps extends RoleRevealEffectProps {
  allRoles?: RoleData[];
}

// ─── Animal data ────────────────────────────────────────────────────────
interface AnimalData {
  id: number;
  role: RoleData;
  isTarget: boolean;
  startX: number;
  y: number;
  speed: number;
  scale: number;
  facingLeft: boolean;
  /** Timestamp (ms since mount) when this animal was spawned */
  spawnTime: number;
  /** Forest animal emoji derived from role ID */
  emoji: string;
}

// ─── Firefly data ───────────────────────────────────────────────────────
interface FireflyData {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  driftRadius: number;
  driftPhase: number;
  driftDuration: number;
  flickerDuration: number;
  baseOpacity: number;
}

function generateFireflies(w: number, h: number): FireflyData[] {
  const arr: FireflyData[] = [];
  for (let i = 0; i < 10; i++) {
    arr.push({
      cx: Math.random() * w,
      cy: h * 0.3 + Math.random() * h * 0.5,
      radius: 1 + Math.random() * 1.5,
      color: HUNT_COLORS.firefly[i % 5],
      driftRadius: 15 + Math.random() * 25,
      driftPhase: Math.random() * Math.PI * 2,
      driftDuration: 3000 + Math.random() * 3000,
      flickerDuration: 400 + Math.random() * 600,
      baseOpacity: 0.3 + Math.random() * 0.5,
    });
  }
  return arr;
}

// ─── Burst ray data ─────────────────────────────────────────────────────
interface BurstRayData {
  angle: number;
  length: number;
}

function generateBurstRays(): BurstRayData[] {
  return Array.from({ length: 12 }, (_, i) => ({
    angle: (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.3,
    length: 60 + Math.random() * 60,
  }));
}

// ─── Celebration particle ───────────────────────────────────────────────
interface CelebrationParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  emoji: string;
  duration: number;
}

const CelebrationParticle: React.FC<CelebrationParticleConfig> = React.memo(
  ({ targetX, targetY, emoji, duration }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, [duration, progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: progress.value * targetX },
        { translateY: progress.value * targetY },
        { scale: interpolate(progress.value, [0, 0.2, 0.4, 1], [0, 1.4, 1.1, 0]) },
        { rotate: `${progress.value * 180}deg` },
      ],
      opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.7, 0]),
    }));

    return (
      <Animated.View style={[styles.celebrationParticle, animStyle]}>
        <Text style={styles.celebrationEmoji}>{emoji}</Text>
      </Animated.View>
    );
  },
);
CelebrationParticle.displayName = 'CelebrationParticle';

// ─── Skia Firefly ───────────────────────────────────────────────────────
interface SkiaFireflyProps {
  firefly: FireflyData;
  drift: SharedValue<number>;
  flicker: SharedValue<number>;
  masterOpacity: SharedValue<number>;
}

const SkiaFirefly: React.FC<SkiaFireflyProps> = React.memo(
  ({ firefly, drift, flicker, masterOpacity }) => {
    const cx = useDerivedValue(
      () =>
        firefly.cx + Math.cos(drift.value * Math.PI * 2 + firefly.driftPhase) * firefly.driftRadius,
    );
    const cy = useDerivedValue(
      () =>
        firefly.cy + Math.sin(drift.value * Math.PI * 2 + firefly.driftPhase) * firefly.driftRadius,
    );
    const opacity = useDerivedValue(() => {
      const flickerVal = 0.5 + Math.sin(flicker.value * Math.PI * 2) * 0.5;
      return masterOpacity.value * interpolate(flickerVal, [0, 1], [0.2, 1]) * firefly.baseOpacity;
    });

    return (
      <Group opacity={opacity}>
        <Circle cx={cx} cy={cy} r={firefly.radius * 2.5} color={firefly.color}>
          <Blur blur={4} />
        </Circle>
        <Circle cx={cx} cy={cy} r={firefly.radius} color={firefly.color} />
      </Group>
    );
  },
);
SkiaFirefly.displayName = 'SkiaFirefly';

// ─── Skia Shot Burst ────────────────────────────────────────────────────
interface SkiaShotBurstProps {
  cx: number;
  cy: number;
  rays: BurstRayData[];
  progress: SharedValue<number>;
}

const SkiaShotBurst: React.FC<SkiaShotBurstProps> = React.memo(({ cx, cy, rays, progress }) => {
  return (
    <Group>
      {rays.map((ray, i) => {
        const RayLine: React.FC = () => {
          const p2 = useDerivedValue(() =>
            vec(
              cx + Math.cos(ray.angle) * ray.length * progress.value,
              cy + Math.sin(ray.angle) * ray.length * progress.value,
            ),
          );
          const op = useDerivedValue(() => Math.max(0, 1 - progress.value) * 0.8);
          return (
            <Group opacity={op}>
              <Line
                p1={vec(cx, cy)}
                p2={p2}
                color={HUNT_COLORS.burstRay}
                style="stroke"
                strokeWidth={3}
                strokeCap="round"
              >
                <Blur blur={3} />
              </Line>
            </Group>
          );
        };
        return <RayLine key={i} />;
      })}
      {/* Shockwave ring */}
      <SkiaShockwave cx={cx} cy={cy} progress={progress} />
    </Group>
  );
});
SkiaShotBurst.displayName = 'SkiaShotBurst';

const SkiaShockwave: React.FC<{ cx: number; cy: number; progress: SharedValue<number> }> =
  React.memo(({ cx, cy, progress }) => {
    const r = useDerivedValue(() => progress.value * 120);
    const op = useDerivedValue(() => Math.max(0, 1 - progress.value) * 0.6);
    return (
      <Group opacity={op}>
        <Circle cx={cx} cy={cy} r={r} color={HUNT_COLORS.shockwave} style="stroke" strokeWidth={2}>
          <Blur blur={2} />
        </Circle>
      </Group>
    );
  });
SkiaShockwave.displayName = 'SkiaShockwave';

// ─── Animated Animal ────────────────────────────────────────────────────
interface AnimatedAnimalProps {
  animal: AnimalData;
  screenWidth: number;
  state: 'alive' | 'hit-target' | 'hit-miss' | 'dead';
}

const AnimatedAnimal: React.FC<AnimatedAnimalProps> = React.memo(
  ({ animal, screenWidth, state }) => {
    const xPos = useSharedValue(animal.startX);
    const bobValue = useSharedValue(0);
    const hitScale = useSharedValue(1);
    const hitOpacity = useSharedValue(1);

    useEffect(() => {
      const travelDistance = screenWidth + ANIMAL_SIZE * 4;
      const duration = (travelDistance / Math.abs(animal.speed)) * 1000;
      const endX = animal.speed > 0 ? screenWidth + ANIMAL_SIZE * 2 : -ANIMAL_SIZE * 2;

      xPos.value = animal.startX;
      xPos.value = withTiming(endX, { duration, easing: Easing.linear });
    }, [xPos, animal.startX, animal.speed, screenWidth]);

    useEffect(() => {
      bobValue.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 600 + (animal.id % 10) * 50,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: 600 + (animal.id % 10) * 50,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
      );
    }, [bobValue, animal.id]);

    useEffect(() => {
      if (state === 'hit-miss') {
        hitScale.value = withSequence(
          withTiming(1.5, { duration: 150 }),
          withTiming(0.3, { duration: 300, easing: Easing.out(Easing.cubic) }),
        );
        hitOpacity.value = withDelay(
          100,
          withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
        );
      } else if (state === 'hit-target') {
        hitScale.value = withSequence(
          withTiming(1.8, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
        );
        hitOpacity.value = withDelay(150, withTiming(0, { duration: 250 }));
      }
    }, [state, hitScale, hitOpacity]);

    const animStyle = useAnimatedStyle(() => {
      const bob = interpolate(bobValue.value, [0, 1], [0, -5]);
      return {
        transform: [
          { translateX: xPos.value - ANIMAL_SIZE / 2 },
          { translateY: animal.y + bob - ANIMAL_SIZE / 2 },
          { scale: animal.scale * hitScale.value },
          { scaleX: animal.facingLeft ? -1 : 1 },
        ],
        opacity: hitOpacity.value,
      };
    });

    if (state === 'dead') return null;

    return (
      <Animated.View style={[styles.animalLabel, animStyle]} pointerEvents="none">
        <Text style={styles.animalEmoji}>{animal.emoji}</Text>
        <View style={[styles.animalNameBg, animal.facingLeft && { transform: [{ scaleX: -1 }] }]}>
          <Text style={styles.animalName}>{animal.role.name}</Text>
        </View>
      </Animated.View>
    );
  },
);
AnimatedAnimal.displayName = 'AnimatedAnimal';

// ─── Forest background (Skia Picture — rendered once) ───────────────────
function createForestPicture(w: number, h: number) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
  (() => {
    const groundY = h * 0.72;

    // Sky gradient
    const skyPaint = Skia.Paint();
    const skyShader = Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: h },
      [
        Skia.Color(SKY_COLORS.top),
        Skia.Color(SKY_COLORS.mid1),
        Skia.Color(SKY_COLORS.mid2),
        Skia.Color(SKY_COLORS.mid3),
        Skia.Color(SKY_COLORS.bottom),
      ],
      [0, 0.3, 0.55, 0.75, 1],
      0,
    );
    if (skyShader) {
      skyPaint.setShader(skyShader);
      canvas.drawRect({ x: 0, y: 0, width: w, height: h }, skyPaint);
    }

    // Stars
    const starPaint = Skia.Paint();
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.45;
      const sr = 0.5 + Math.random() * 2;
      starPaint.setColor(Skia.Color(`rgba(200, 220, 255, ${0.3 + Math.random() * 0.7})`));
      canvas.drawCircle(sx, sy, sr, starPaint);
    }

    // Moon
    const mx = w * 0.8;
    const my = h * 0.12;
    const moonGlow = Skia.Paint();
    const moonGlowShader = Skia.Shader.MakeRadialGradient(
      { x: mx, y: my },
      60,
      [
        Skia.Color('rgba(200,220,255,0.3)'),
        Skia.Color('rgba(200,220,255,0.08)'),
        Skia.Color('rgba(200,220,255,0)'),
      ],
      [0, 0.5, 1],
      0,
    );
    if (moonGlowShader) {
      moonGlow.setShader(moonGlowShader);
      canvas.drawCircle(mx, my, 60, moonGlow);
    }
    const moonBody = Skia.Paint();
    moonBody.setColor(Skia.Color('rgba(230, 240, 255, 0.92)'));
    canvas.drawCircle(mx, my, 14, moonBody);
    const moonShadow = Skia.Paint();
    moonShadow.setColor(Skia.Color(SKY_COLORS.top));
    canvas.drawCircle(mx + 6, my - 3, 11, moonShadow);

    // Distant hills
    const hillPaint = Skia.Paint();
    hillPaint.setColor(Skia.Color('#0a2018'));
    const hillPath = Skia.Path.Make();
    hillPath.moveTo(0, h * 0.55);
    for (let x = 0; x <= w; x += 20) {
      hillPath.lineTo(x, h * 0.55 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.015) * 15);
    }
    hillPath.lineTo(w, h);
    hillPath.lineTo(0, h);
    hillPath.close();
    canvas.drawPath(hillPath, hillPaint);

    // Tree lines
    drawSkiaTreeLine(canvas, w, h, h * 0.5, 0.6, '#071510', 25, 60);
    drawSkiaTreeLine(canvas, w, h, h * 0.58, 0.8, '#0a1f15', 18, 80);

    // Ground
    const groundPaint = Skia.Paint();
    const groundShader = Skia.Shader.MakeLinearGradient(
      { x: 0, y: groundY },
      { x: 0, y: h },
      [Skia.Color('#122a1a'), Skia.Color('#0d1f12'), Skia.Color('#080f08')],
      [0, 0.5, 1],
      0,
    );
    if (groundShader) {
      groundPaint.setShader(groundShader);
      canvas.drawRect({ x: 0, y: groundY, width: w, height: h - groundY }, groundPaint);
    }

    // Grass tufts
    const grassPaint = Skia.Paint();
    grassPaint.setColor(Skia.Color('rgba(40, 80, 50, 0.6)'));
    grassPaint.setStyle(1); // Stroke
    grassPaint.setStrokeWidth(1.5);
    grassPaint.setStrokeCap(1); // Round
    for (let i = 0; i < 80; i++) {
      const gx = Math.random() * w;
      const gy = groundY + Math.random() * (h - groundY) * 0.3;
      const gh = 8 + Math.random() * 14;
      const grassPath = Skia.Path.Make();
      grassPath.moveTo(gx, gy);
      grassPath.quadTo(
        gx + (Math.random() - 0.5) * 10,
        gy - gh,
        gx + (Math.random() - 0.5) * 6,
        gy - gh,
      );
      canvas.drawPath(grassPath, grassPaint);
    }

    // Foreground trees
    drawSkiaSilhouetteTree(canvas, h, -20, h * 0.25, 1);
    drawSkiaSilhouetteTree(canvas, h, w - 40, h * 0.2, -1);
    if (w > 350) {
      drawSkiaSilhouetteTree(canvas, h, w * 0.15, h * 0.35, 1);
      drawSkiaSilhouetteTree(canvas, h, w * 0.78, h * 0.3, -1);
    }

    // Low fog
    for (let i = 0; i < 6; i++) {
      const fx = Math.random() * w;
      const fy = groundY - 10 + Math.random() * 40;
      const fr = 80 + Math.random() * 120;
      const fogPaint = Skia.Paint();
      const fogShader = Skia.Shader.MakeRadialGradient(
        { x: fx, y: fy },
        fr,
        [Skia.Color('rgba(100,140,120,0.15)'), Skia.Color('rgba(100,140,120,0)')],
        [0, 1],
        0,
      );
      if (fogShader) {
        fogPaint.setShader(fogShader);
        canvas.drawCircle(fx, fy, fr, fogPaint);
      }
    }

    // Vignette
    const vigPaint = Skia.Paint();
    const vigR = Math.max(w, h) * 0.7;
    const vigShader = Skia.Shader.MakeRadialGradient(
      { x: w / 2, y: h / 2 },
      vigR,
      [Skia.Color('rgba(0,0,0,0)'), Skia.Color('rgba(0,0,0,0.6)')],
      [0, 1],
      0,
    );
    if (vigShader) {
      vigPaint.setShader(vigShader);
      canvas.drawRect({ x: 0, y: 0, width: w, height: h }, vigPaint);
    }
  })();
  return recorder.finishRecordingAsPicture();
}

function drawSkiaTreeLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SkCanvas not re-exported
  canvas: any,
  w: number,
  h: number,
  baseY: number,
  density: number,
  color: string,
  minH: number,
  maxH: number,
) {
  const treePaint = Skia.Paint();
  treePaint.setColor(Skia.Color(color));
  const treePath = Skia.Path.Make();
  treePath.moveTo(0, h);
  for (let x = -10; x <= w + 10; x += 12 + Math.random() * 8) {
    if (Math.random() > density) continue;
    const tH = minH + Math.random() * maxH;
    const tW = 6 + Math.random() * 10;
    const by = baseY + Math.sin(x * 0.01) * 20;
    treePath.lineTo(x - tW / 2, by);
    treePath.lineTo(x, by - tH);
    treePath.lineTo(x + tW / 2, by);
  }
  treePath.lineTo(w + 10, h);
  treePath.close();
  canvas.drawPath(treePath, treePaint);
}

function drawSkiaSilhouetteTree(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SkCanvas not re-exported
  canvas: any,
  h: number,
  x: number,
  topY: number,
  dir: number,
) {
  const treePaint = Skia.Paint();
  treePaint.setColor(Skia.Color('#040d08'));
  canvas.drawRect({ x: x + 20 * dir, y: topY + 40, width: 18, height: h - topY - 40 }, treePaint);
  for (let i = 0; i < 3; i++) {
    const ly = topY + i * 35;
    const lw = 50 - i * 8;
    const canopyPath = Skia.Path.Make();
    canopyPath.moveTo(x + 28 * dir - lw, ly + 50);
    canopyPath.lineTo(x + 28 * dir, ly);
    canopyPath.lineTo(x + 28 * dir + lw, ly + 50);
    canopyPath.close();
    canvas.drawPath(canopyPath, treePaint);
  }
}

// ─── Animal generation ──────────────────────────────────────────────────
let animalIdCounter = 0;

function createAnimal(
  role: RoleData,
  targetRole: RoleData,
  screenWidth: number,
  screenHeight: number,
): AnimalData {
  const fromLeft = Math.random() > 0.5;
  const minY = screenHeight * GROUND_TOP_RATIO;
  const maxY = screenHeight * (1 - GROUND_BOTTOM_PADDING_RATIO);
  const y = minY + Math.random() * (maxY - minY);
  const speed = 40 + Math.random() * 60;

  return {
    id: animalIdCounter++,
    role,
    isTarget: role.id === targetRole.id,
    startX: fromLeft ? -ANIMAL_SIZE : screenWidth + ANIMAL_SIZE,
    y,
    speed: fromLeft ? speed : -speed,
    scale: 0.85 + Math.random() * 0.3,
    facingLeft: !fromLeft,
    spawnTime: Date.now(),
    emoji: roleIdToAnimalEmoji(role.id),
  };
}

/**
 * Estimate the current X position of an animal at a given timestamp.
 * Animals use Reanimated withTiming(linear) from startX to endX,
 * so we replicate the same linear interpolation on the JS thread.
 */
function estimateAnimalX(animal: AnimalData, screenWidth: number, nowMs: number): number {
  const travelDistance = screenWidth + ANIMAL_SIZE * 4;
  const totalDuration = (travelDistance / Math.abs(animal.speed)) * 1000;
  const elapsed = nowMs - animal.spawnTime;
  const progress = Math.min(1, elapsed / totalDuration);
  const endX = animal.speed > 0 ? screenWidth + ANIMAL_SIZE * 2 : -ANIMAL_SIZE * 2;
  return animal.startX + (endX - animal.startX) * progress;
}

// ─── Main component ─────────────────────────────────────────────────────
export const RoleHunt: React.FC<RoleHuntProps> = ({
  role,
  onComplete,
  allRoles,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'role-hunt',
}) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
  const common = CONFIG.common;
  const config = CONFIG.roleHunt;

  const [phase, setPhase] = useState<'hunting' | 'capturing' | 'revealing' | 'revealed'>('hunting');
  const [animals, setAnimals] = useState<AnimalData[]>([]);
  const [animalStates, setAnimalStates] = useState<
    Record<number, 'alive' | 'hit-target' | 'hit-miss' | 'dead'>
  >({});
  const [celebrations, setCelebrations] = useState<CelebrationParticleConfig[]>([]);
  const [hitBurstPos, setHitBurstPos] = useState<{ x: number; y: number } | null>(null);

  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  const hitRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetSpawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  const animalsRef = useRef(animals);
  const animalStatesRef = useRef(animalStates);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    animalsRef.current = animals;
  }, [animals]);
  useEffect(() => {
    animalStatesRef.current = animalStates;
  }, [animalStates]);

  const spawnRoles = useMemo(() => {
    const roles = allRoles ?? [role];
    if (!roles.find((r) => r.id === role.id)) return [role, ...roles];
    return roles;
  }, [allRoles, role]);

  const [fireflies] = useState(() => generateFireflies(screenWidth, screenHeight));
  const [burstRays] = useState(generateBurstRays);
  const forestPicture = useMemo(
    () => createForestPicture(screenWidth, screenHeight),
    [screenWidth, screenHeight],
  );

  // ── Shared values ──
  const scopeX = useSharedValue(screenWidth / 2);
  const scopeY = useSharedValue(screenHeight / 2);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const atmosphereOpacity = useSharedValue(1);
  const hitFlashOpacity = useSharedValue(0);
  const burstProgress = useSharedValue(0);
  const hintOpacity = useSharedValue(1);

  // Firefly shared values (10 × 2)
  const ffDrift0 = useSharedValue(0);
  const ffDrift1 = useSharedValue(0);
  const ffDrift2 = useSharedValue(0);
  const ffDrift3 = useSharedValue(0);
  const ffDrift4 = useSharedValue(0);
  const ffDrift5 = useSharedValue(0);
  const ffDrift6 = useSharedValue(0);
  const ffDrift7 = useSharedValue(0);
  const ffDrift8 = useSharedValue(0);
  const ffDrift9 = useSharedValue(0);
  const ffDrifts = useMemo(
    () => [
      ffDrift0,
      ffDrift1,
      ffDrift2,
      ffDrift3,
      ffDrift4,
      ffDrift5,
      ffDrift6,
      ffDrift7,
      ffDrift8,
      ffDrift9,
    ],
    [
      ffDrift0,
      ffDrift1,
      ffDrift2,
      ffDrift3,
      ffDrift4,
      ffDrift5,
      ffDrift6,
      ffDrift7,
      ffDrift8,
      ffDrift9,
    ],
  );
  const ffFlicker0 = useSharedValue(0);
  const ffFlicker1 = useSharedValue(0);
  const ffFlicker2 = useSharedValue(0);
  const ffFlicker3 = useSharedValue(0);
  const ffFlicker4 = useSharedValue(0);
  const ffFlicker5 = useSharedValue(0);
  const ffFlicker6 = useSharedValue(0);
  const ffFlicker7 = useSharedValue(0);
  const ffFlicker8 = useSharedValue(0);
  const ffFlicker9 = useSharedValue(0);
  const ffFlickers = useMemo(
    () => [
      ffFlicker0,
      ffFlicker1,
      ffFlicker2,
      ffFlicker3,
      ffFlicker4,
      ffFlicker5,
      ffFlicker6,
      ffFlicker7,
      ffFlicker8,
      ffFlicker9,
    ],
    [
      ffFlicker0,
      ffFlicker1,
      ffFlicker2,
      ffFlicker3,
      ffFlicker4,
      ffFlicker5,
      ffFlicker6,
      ffFlicker7,
      ffFlicker8,
      ffFlicker9,
    ],
  );

  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Start atmosphere animations ──
  useEffect(() => {
    if (reducedMotion) return;
    fireflies.forEach((f, i) => {
      ffDrifts[i].value = withRepeat(
        withTiming(1, { duration: f.driftDuration, easing: Easing.linear }),
        -1,
      );
      ffFlickers[i].value = withRepeat(
        withSequence(
          withTiming(1, { duration: f.flickerDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: f.flickerDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    });
    hintOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [reducedMotion, fireflies, ffDrifts, ffFlickers, hintOpacity]);

  // ── Animal spawning ──
  useEffect(() => {
    if (reducedMotion) return;

    const initialAnimals: AnimalData[] = [];
    initialAnimals.push(createAnimal(role, role, screenWidth, screenHeight));
    for (let i = 0; i < 3; i++) {
      const randomRole = spawnRoles[Math.floor(Math.random() * spawnRoles.length)];
      initialAnimals.push(createAnimal(randomRole, role, screenWidth, screenHeight));
    }
    setAnimals(initialAnimals);
    const initialStates: Record<number, 'alive'> = {};
    for (const a of initialAnimals) initialStates[a.id] = 'alive';
    setAnimalStates(initialStates);

    spawnTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'hunting') return;
      const randomRole = spawnRoles[Math.floor(Math.random() * spawnRoles.length)];
      const newAnimal = createAnimal(randomRole, role, screenWidth, screenHeight);
      setAnimals((prev) => [...prev, newAnimal]);
      setAnimalStates((prev) => ({ ...prev, [newAnimal.id]: 'alive' }));
    }, SPAWN_INTERVAL_MS);

    targetSpawnTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'hunting') return;
      const hasTarget = animalsRef.current.some(
        (a) => a.isTarget && (animalStatesRef.current[a.id] ?? 'alive') === 'alive',
      );
      if (!hasTarget) {
        const newTarget = createAnimal(role, role, screenWidth, screenHeight);
        setAnimals((prev) => [...prev, newTarget]);
        setAnimalStates((prev) => ({ ...prev, [newTarget.id]: 'alive' }));
      }
    }, TARGET_SPAWN_INTERVAL_MS);

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Clean up
  useEffect(() => {
    return () => {
      if (hitRevealTimerRef.current) clearTimeout(hitRevealTimerRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);
    };
  }, []);

  const createCelebrations = useCallback(() => {
    const configs: CelebrationParticleConfig[] = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 60 + Math.random() * 180;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 20,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
        duration: 500 + Math.random() * 500,
      });
    }
    setCelebrations(configs);
  }, []);

  const startReveal = useCallback(() => {
    setPhase('revealing');
    createCelebrations();
    if (enableHaptics) triggerHaptic('heavy', true);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);

    atmosphereOpacity.value = withTiming(0, { duration: 600 });
    cardOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withTiming(
      1,
      { duration: 400, easing: Easing.out(Easing.back(1.5)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('revealed');
      },
    );
  }, [cardScale, cardOpacity, atmosphereOpacity, createCelebrations, enableHaptics]);

  // Auto-timeout (warning + 8s auto-reveal)
  const autoTimeoutWarning = useAutoTimeout(phase === 'hunting' && !reducedMotion, startReveal);

  // ── Shooting ──
  const handleShoot = useCallback(
    (sx: number, sy: number) => {
      if (phaseRef.current !== 'hunting') return;

      if (enableHaptics) triggerHaptic('medium', true);

      // Subtle flash
      hitFlashOpacity.value = withSequence(
        withTiming(0.3, { duration: 50 }),
        withTiming(0, { duration: 200 }),
      );

      // Hit detection — estimate each animal's current X position
      const now = Date.now();
      let hitAnimal: AnimalData | null = null;
      let closestDist = HIT_RADIUS;

      for (const a of animalsRef.current) {
        const st = animalStatesRef.current[a.id];
        if (st !== 'alive' && st !== undefined) continue;
        const estimatedX = estimateAnimalX(a, screenWidth, now);
        const dx = estimatedX - sx;
        const dy = a.y - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          hitAnimal = a;
        }
      }

      if (hitAnimal) {
        const animal = hitAnimal;
        if (animal.isTarget) {
          setPhase('capturing');
          setAnimalStates((prev) => {
            const next = { ...prev };
            next[animal.id] = 'hit-target';
            for (const a of animalsRef.current) {
              if (a.id !== animal.id && (next[a.id] === 'alive' || !next[a.id])) {
                next[a.id] = 'hit-miss';
              }
            }
            return next;
          });
          if (enableHaptics) triggerHaptic('success', true);

          setHitBurstPos({ x: sx, y: sy });
          burstProgress.value = 0;
          burstProgress.value = withTiming(1, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
          });

          hitFlashOpacity.value = withSequence(
            withTiming(0.5, { duration: 80 }),
            withTiming(0, { duration: 400 }),
          );

          const timer = setTimeout(() => startReveal(), config.hitRevealDelay);
          hitRevealTimerRef.current = timer;
        } else {
          setAnimalStates((prev) => ({ ...prev, [animal.id]: 'hit-miss' }));
          if (enableHaptics) triggerHaptic('light', true);
          hitFlashOpacity.value = withSequence(
            withTiming(0.15, { duration: 50 }),
            withTiming(0, { duration: 200 }),
          );
        }
      }
    },
    [
      screenWidth,
      enableHaptics,
      config.hitRevealDelay,
      startReveal,
      hitFlashOpacity,
      burstProgress,
    ],
  );

  // ── Gesture ──
  const handleShootRef = useRef(handleShoot);
  useEffect(() => {
    handleShootRef.current = handleShoot;
  }, [handleShoot]);

  const scopeXRef = useRef(scopeX);
  const scopeYRef = useRef(scopeY);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reducedMotion)
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          scopeXRef.current.value = e.absoluteX;
          scopeYRef.current.value = e.absoluteY;
        })
        .onChange((e) => {
          'worklet';
          scopeXRef.current.value = e.absoluteX;
          scopeYRef.current.value = e.absoluteY;
        })
        .onEnd((e) => {
          'worklet';
          runOnJS(handleShootRef.current)(e.absoluteX, e.absoluteY);
        }),
    [reducedMotion],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!reducedMotion)
        .onBegin((e) => {
          'worklet';
          scopeXRef.current.value = e.absoluteX;
          scopeYRef.current.value = e.absoluteY;
        })
        .onEnd((e) => {
          'worklet';
          runOnJS(handleShootRef.current)(e.absoluteX, e.absoluteY);
        }),
    [reducedMotion],
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // ── Reduced motion: skip to reveal ──
  useEffect(() => {
    if (!reducedMotion) return;
    cardOpacity.value = 1;
    cardScale.value = 1;
    setPhase('revealed');
    fireComplete();
  }, [reducedMotion, cardOpacity, cardScale, fireComplete]);

  // ── Animated styles ──
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const hitFlashStyle = useAnimatedStyle(() => ({
    opacity: hitFlashOpacity.value,
  }));

  // ── Scope Skia overlay ──
  // We use a derived value for crosshair line endpoints
  // Crosshair line endpoints as derived SkPoint values
  const crossLeftP1 = useDerivedValue(() => vec(scopeX.value - (SCOPE_RADIUS - 10), scopeY.value));
  const crossLeftP2 = useDerivedValue(() => vec(scopeX.value - 12, scopeY.value));
  const crossRightP1 = useDerivedValue(() => vec(scopeX.value + 12, scopeY.value));
  const crossRightP2 = useDerivedValue(() => vec(scopeX.value + (SCOPE_RADIUS - 10), scopeY.value));
  const crossTopP1 = useDerivedValue(() => vec(scopeX.value, scopeY.value - (SCOPE_RADIUS - 10)));
  const crossTopP2 = useDerivedValue(() => vec(scopeX.value, scopeY.value - 12));
  const crossBotP1 = useDerivedValue(() => vec(scopeX.value, scopeY.value + 12));
  const crossBotP2 = useDerivedValue(() => vec(scopeX.value, scopeY.value + (SCOPE_RADIUS - 10)));

  return (
    <GestureDetector gesture={composedGesture}>
      <View testID={`${testIDPrefix}-container`} style={styles.container}>
        {/* Skia layer: forest bg + fireflies + scope + burst */}
        {!reducedMotion && (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Picture picture={forestPicture} />

            {fireflies.map((f, i) => (
              <SkiaFirefly
                key={`ff-${i}`}
                firefly={f}
                drift={ffDrifts[i]}
                flicker={ffFlickers[i]}
                masterOpacity={atmosphereOpacity}
              />
            ))}

            {/* Scope dark overlay */}
            {phase === 'hunting' && (
              <Group>
                <Rect
                  x={0}
                  y={0}
                  width={screenWidth}
                  height={screenHeight}
                  color={SCOPE_COLORS.overlay}
                />
                {/* Lens brightening */}
                <Circle cx={scopeX} cy={scopeY} r={SCOPE_RADIUS}>
                  <RadialGradient
                    c={vec(0, 0)}
                    r={SCOPE_RADIUS}
                    colors={[SCOPE_COLORS.lensCenter, SCOPE_COLORS.lensEdge, 'transparent']}
                    positions={[0, 0.7, 1]}
                  />
                </Circle>
                {/* Scope ring */}
                <Circle
                  cx={scopeX}
                  cy={scopeY}
                  r={SCOPE_RADIUS}
                  color={SCOPE_COLORS.ring}
                  style="stroke"
                  strokeWidth={3}
                />
                {/* Outer ring */}
                <Circle
                  cx={scopeX}
                  cy={scopeY}
                  r={SCOPE_RADIUS + 6}
                  color={SCOPE_COLORS.outerRing}
                  style="stroke"
                  strokeWidth={1.5}
                />
                {/* Crosshair lines */}
                <Line
                  p1={crossLeftP1}
                  p2={crossLeftP2}
                  color={SCOPE_COLORS.crosshair}
                  style="stroke"
                  strokeWidth={1}
                />
                <Line
                  p1={crossRightP1}
                  p2={crossRightP2}
                  color={SCOPE_COLORS.crosshair}
                  style="stroke"
                  strokeWidth={1}
                />
                <Line
                  p1={crossTopP1}
                  p2={crossTopP2}
                  color={SCOPE_COLORS.crosshair}
                  style="stroke"
                  strokeWidth={1}
                />
                <Line
                  p1={crossBotP1}
                  p2={crossBotP2}
                  color={SCOPE_COLORS.crosshair}
                  style="stroke"
                  strokeWidth={1}
                />
                {/* Center dot */}
                <Circle cx={scopeX} cy={scopeY} r={2} color={SCOPE_COLORS.centerDot} />
              </Group>
            )}

            {/* Hit burst */}
            {hitBurstPos && (
              <SkiaShotBurst
                cx={hitBurstPos.x}
                cy={hitBurstPos.y}
                rays={burstRays}
                progress={burstProgress}
              />
            )}
          </Canvas>
        )}

        {/* Reduced motion fallback background */}
        {reducedMotion && (
          <LinearGradient
            colors={[SKY_COLORS.top, SKY_COLORS.mid2, SKY_COLORS.bottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        )}

        {/* Hit flash overlay */}
        <Animated.View
          style={[styles.flash, hitFlashStyle, { backgroundColor: HUNT_COLORS.hitFlash }]}
          pointerEvents="none"
        />

        {/* Animals */}
        {!reducedMotion && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {animals.map((animal) => (
              <AnimatedAnimal
                key={animal.id}
                animal={animal}
                screenWidth={screenWidth}
                state={animalStates[animal.id] ?? 'alive'}
              />
            ))}
          </View>
        )}

        {/* Hint */}
        <HintWithWarning
          hintText={
            phase === 'hunting' && !reducedMotion ? '🔫 移动瞄准，抬手射击 — 找到你的角色！' : null
          }
          showWarning={autoTimeoutWarning}
        />

        {/* Celebrations */}
        {celebrations.length > 0 && (
          <View style={styles.celebrationContainer}>
            {celebrations.map((p) => (
              <CelebrationParticle key={p.id} {...p} />
            ))}
          </View>
        )}

        {/* Revealed card */}
        {(phase === 'revealing' || phase === 'revealed') && (
          <Animated.View
            style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, cardAnimStyle]}
          >
            <RoleCardContent
              roleId={role.id as RoleId}
              width={cardWidth}
              height={cardHeight}
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />
            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                animate={!reducedMotion}
                onComplete={fireComplete}
              />
            )}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: SKY_COLORS.top,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },

  animalLabel: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  animalEmoji: {
    fontSize: 44,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.5)', 0, 2, 4),
  },
  animalNameBg: {
    backgroundColor: HUNT_COLORS.animalNameBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  animalName: {
    fontSize: 12,
    fontWeight: '600',
    color: HUNT_COLORS.animalName,
  },
  celebrationContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 15,
  },
  celebrationParticle: {
    position: 'absolute',
  },
  celebrationEmoji: {
    fontSize: 26,
  },
  cardContainer: {
    zIndex: 20,
    overflow: 'visible',
  },
});

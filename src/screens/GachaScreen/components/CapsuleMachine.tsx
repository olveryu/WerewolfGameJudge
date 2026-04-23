/**
 * CapsuleMachine — SVG 扭蛋机渲染组件
 *
 * 使用 SVG + Reanimated useAnimatedProps 渲染：
 * 背景、机身、玻璃罩、28 颗球、管道、旋钮、地面、闪光。
 * 物理状态来自 useGachaPhysics 的 shared values。
 *
 * 球通过 AnimatedBall 子组件驱动（每个球 1 个 useAnimatedProps）。
 * 碎片/火花通过 useAnimatedReaction → React state 桥接渲染。
 */
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, {
  Circle as SvgCircle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line as SvgLine,
  Path as SvgPath,
  Rect as SvgRect,
} from 'react-native-svg';

import { colors } from '@/theme/colors';

import {
  BALL_COLORS,
  BALL_R,
  BODY_B,
  BODY_L,
  BODY_R,
  BODY_T,
  CHUTE_BOT,
  CHUTE_TOP,
  DIAL_Y,
  DOME_CX,
  DOME_CY,
  DOME_R,
  FLOOR_Y,
  HOLE_CX,
  HOLE_HALF_W,
  HOLE_Y,
  MACHINE,
  NUM_BALLS,
  REF_H,
  REF_W,
} from '../gachaConstants';
import { useGachaPhysics } from '../hooks/useGachaPhysics';

// ─── Ball stride constants (must match useGachaPhysics) ─────────────────
const STRIDE = 6;
const F_ESCAPED = 1;
const F_OPENED = 4;

// Shell / sparkle stride constants
const SHELL_STRIDE = 9;
const SPARK_STRIDE = 7;

// Rarity glow colors (CSS — indexed 0-3: common, rare, epic, legendary)
const RARITY_GLOW_CSS = [
  'rgba(158,158,158,0.5)',
  'rgba(74,144,217,0.6)',
  'rgba(155,89,182,0.7)',
  'rgba(245,166,35,0.8)',
];

// ─── Animated SVG components ────────────────────────────────────────────
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvgPath = Animated.createAnimatedComponent(SvgPath);
const AnimatedSvgRect = Animated.createAnimatedComponent(SvgRect);

// ─── AnimatedBall ───────────────────────────────────────────────────────

interface AnimatedBallProps {
  index: number;
  ballData: SharedValue<number[]>;
  showWhenEscaped: boolean;
  r: number;
}

/**
 * Single capsule ball — animated position + visibility from physics ballData.
 * Top half colored, bottom half white, center line, highlight, ring, outline.
 * Drawn at local (0,0); AnimatedG x/y moves to physics position.
 */
const AnimatedBall = React.memo<AnimatedBallProps>(function AnimatedBall({
  index,
  ballData,
  showWhenEscaped,
  r,
}) {
  const color = BALL_COLORS[index % BALL_COLORS.length];

  const groupProps = useAnimatedProps(() => {
    const base = index * STRIDE;
    const bx = ballData.value[base];
    const by = ballData.value[base + 1];
    const flags = ballData.value[base + 5];
    const escaped = (flags & F_ESCAPED) !== 0;
    const opened = (flags & F_OPENED) !== 0;
    const visible = showWhenEscaped ? escaped && !opened : !escaped && !opened;
    return { x: bx, y: by, opacity: visible ? 1 : 0 };
  });

  // Pre-compute arc paths (radius stable per animation cycle)
  // Top half pie: center → left → arc clockwise through top → close
  const topArc = `M 0 0 L ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`;
  // Bottom half pie: center → right → arc clockwise through bottom → close
  const botArc = `M 0 0 L ${r} 0 A ${r} ${r} 0 0 1 ${-r} 0 Z`;

  return (
    <AnimatedG animatedProps={groupProps}>
      <SvgPath d={topArc} fill={color} />
      <SvgPath d={botArc} fill="white" />
      <SvgLine x1={-r} y1={0} x2={r} y2={0} stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />
      <SvgCircle cx={-r * 0.28} cy={-r * 0.35} r={r * 0.22} fill="rgba(255,255,255,0.3)" />
      <SvgCircle
        cx={0}
        cy={-r * 0.08}
        r={r * 0.28}
        stroke="rgba(255,255,255,0.2)"
        fill="none"
        strokeWidth={1.5}
      />
      <SvgCircle cx={0} cy={0} r={r} stroke="rgba(0,0,0,0.12)" fill="none" strokeWidth={1} />
    </AnimatedG>
  );
});

// ─── Types ──────────────────────────────────────────────────────────────

export interface CapsuleMachineRef {
  startAnimation: (drawType: 'normal' | 'golden', count: number) => void;
  setResults: (rarities: string[]) => void;
  cancelAnimation: () => void;
}

interface CapsuleMachineProps {
  width: number;
  height: number;
  drawType: 'normal' | 'golden';
  onPhaseChange?: (phase: number) => void;
}

interface ShellData {
  x: number;
  y: number;
  size: number;
  alpha: number;
  colorIdx: number;
}

interface SparkData {
  x: number;
  y: number;
  life: number;
  size: number;
  rarityIdx: number;
}

// ─── Component ──────────────────────────────────────────────────────────

export const CapsuleMachine = forwardRef<CapsuleMachineRef, CapsuleMachineProps>(
  function CapsuleMachine({ width, height, drawType, onPhaseChange }, ref) {
    const scale = Math.min(width / REF_W, height / REF_H);
    const s = scale;
    const canvasW = REF_W * s;
    const canvasH = REF_H * s;

    const physics = useGachaPhysics(scale);

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        startAnimation: physics.startAnimation,
        setResults: physics.setResults,
        cancelAnimation: physics.cancelAnimation,
      }),
      [physics.startAnimation, physics.setResults, physics.cancelAnimation],
    );

    // Notify parent of phase changes
    useAnimatedReaction(
      () => physics.phase.value,
      (current, previous) => {
        if (current !== previous && onPhaseChange) {
          runOnJS(onPhaseChange)(current);
        }
      },
    );

    // Ball radius — stable after preSettle; track changes for single/multi draws
    const [ballR, setBallR] = useState(physics.ballData.value[4] || BALL_R * s);
    useAnimatedReaction(
      () => physics.ballData.value[4],
      (r, prev) => {
        if (r > 0 && r !== prev) runOnJS(setBallR)(r);
      },
    );

    const ballIndices = useMemo(() => Array.from({ length: NUM_BALLS }, (_, i) => i), []);

    // ── Particle sync (worklet → React state) ────────────────────────
    const [particles, setParticles] = useState<{
      shells: ShellData[];
      sparkles: SparkData[];
    }>({ shells: [], sparkles: [] });

    const syncParticles = useCallback((sp: number[], sk: number[]) => {
      const shells: ShellData[] = [];
      for (let i = 0; i < sp.length; i += SHELL_STRIDE) {
        if (sp[i + 7] > 0) {
          shells.push({
            x: sp[i],
            y: sp[i + 1],
            size: sp[i + 4],
            alpha: sp[i + 7],
            colorIdx: sp[i + 8],
          });
        }
      }
      const sparkles: SparkData[] = [];
      for (let i = 0; i < sk.length; i += SPARK_STRIDE) {
        if (sk[i + 4] > 0) {
          sparkles.push({
            x: sk[i],
            y: sk[i + 1],
            life: sk[i + 4],
            size: sk[i + 5],
            rarityIdx: sk[i + 6],
          });
        }
      }
      setParticles({ shells, sparkles });
    }, []);

    useAnimatedReaction(
      () => physics.renderTick.value,
      () => {
        const sp = physics.shellPieces.value;
        const sk = physics.sparkles.value;
        if (sp.length === 0 && sk.length === 0) return;
        runOnJS(syncParticles)(sp, sk);
      },
    );

    // ── Animated chute path (width depends on gate state) ────────────
    const chutePathProps = useAnimatedProps(() => {
      const chuteHW = physics.gateOpen.value === 1 ? 40 * s : 28 * s;
      const W = canvasW;
      return {
        d: [
          `M ${W / 2 - chuteHW} ${CHUTE_TOP * s}`,
          `L ${W / 2 - chuteHW + 4 * s} ${CHUTE_BOT * s}`,
          `Q ${W / 2} ${CHUTE_BOT * s + 12 * s} ${W / 2 + chuteHW - 4 * s} ${CHUTE_BOT * s}`,
          `L ${W / 2 + chuteHW} ${CHUTE_TOP * s}`,
          'Z',
        ].join(' '),
      };
    });

    // Gate indicator visibility
    const gateProps = useAnimatedProps(() => ({
      opacity: physics.gateOpen.value === 1 ? 1 : 0,
    }));

    // Flash overlay
    const flashStyle = useAnimatedStyle(() => ({
      opacity: physics.flashAlpha.value,
    }));

    // ── Animated styles for shake ──────────────────────────────────────
    const shakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: physics.shakeX.value }, { translateY: physics.shakeY.value }],
    }));

    // ── Pre-scaled geometry ────────────────────────────────────────────
    const W = canvasW;
    const H = canvasH;
    const domeCx = DOME_CX * s;
    const domeCy = DOME_CY * s;
    const domeR = DOME_R * s;

    // ── Label text ────────────────────────────────────────────────────
    const labelStyle = useMemo(
      () => ({
        position: 'absolute' as const,
        top: (BODY_T + 12) * s,
        left: 0,
        right: 0,
        textAlign: 'center' as const,
        fontSize: 12 * s,
        fontWeight: '900' as const,
        letterSpacing: 3,
        color: drawType === 'golden' ? 'rgba(245,200,80,0.7)' : 'rgba(200,200,240,0.5)',
      }),
      [s, drawType],
    );

    return (
      <View style={[styles.container, { width: canvasW, height: canvasH }]}>
        <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
          <Svg width={canvasW} height={canvasH}>
            <Defs>
              <ClipPath id="dome-clip">
                <SvgCircle cx={domeCx} cy={domeCy} r={domeR} />
              </ClipPath>
            </Defs>

            {/* Background */}
            <SvgRect x={0} y={0} width={W} height={H} fill={MACHINE.bg} />
            {/* Radial glow behind dome */}
            <SvgCircle cx={W / 2} cy={H * 0.32} r={H * 0.55} fill={MACHINE.bgLight} opacity={0.2} />
            <SvgCircle
              cx={W / 2}
              cy={H * 0.32}
              r={H * 0.35}
              fill={MACHINE.bgLight}
              opacity={0.35}
            />
            <SvgCircle cx={W / 2} cy={H * 0.32} r={H * 0.2} fill={MACHINE.bgLight} opacity={0.15} />

            {/* Floor */}
            <SvgRect
              x={0}
              y={FLOOR_Y * s}
              width={W}
              height={H - FLOOR_Y * s}
              fill={MACHINE.floor}
            />
            <SvgLine
              x1={30 * s}
              y1={FLOOR_Y * s}
              x2={W - 30 * s}
              y2={FLOOR_Y * s}
              stroke={MACHINE.floorLine}
              strokeWidth={1}
            />

            {/* Shadow */}
            <Ellipse
              cx={W / 2}
              cy={BODY_B * s + 24 * s}
              rx={148 * s}
              ry={14 * s}
              fill={MACHINE.shadow}
            />

            {/* Machine body */}
            <SvgRect
              x={BODY_L * s}
              y={BODY_T * s}
              width={(BODY_R - BODY_L) * s}
              height={(BODY_B - BODY_T) * s}
              rx={6 * s}
              ry={6 * s}
              fill={MACHINE.bodyMid}
            />
            <SvgRect
              x={BODY_L * s}
              y={BODY_T * s}
              width={(BODY_R - BODY_L) * s}
              height={(BODY_B - BODY_T) * s}
              rx={6 * s}
              ry={6 * s}
              stroke={MACHINE.bodyEdge}
              fill="none"
              strokeWidth={2}
            />

            {/* Dome balls (clipped to dome circle) */}
            <G clipPath="url(#dome-clip)">
              {ballIndices.map((i) => (
                <AnimatedBall
                  key={`dome-${i}`}
                  index={i}
                  ballData={physics.ballData}
                  showWhenEscaped={false}
                  r={ballR}
                />
              ))}
            </G>

            {/* Dome outline (stroke first, then glass fill on top) */}
            <SvgCircle
              cx={domeCx}
              cy={domeCy}
              r={domeR}
              stroke={MACHINE.domeStroke}
              fill="none"
              strokeWidth={3}
            />
            <SvgCircle cx={domeCx} cy={domeCy} r={domeR} fill={MACHINE.dome} />
            {/* Left arc highlight */}
            <Ellipse
              cx={domeCx - 55 * s}
              cy={domeCy - 15 * s}
              rx={16 * s}
              ry={72 * s}
              fill="rgba(255,255,255,0.13)"
            />
            {/* Top-right small highlight */}
            <Ellipse
              cx={domeCx + 45 * s}
              cy={domeCy - 55 * s}
              rx={10 * s}
              ry={22 * s}
              fill="rgba(255,255,255,0.07)"
            />
            {/* Bottom reflection arc */}
            <Ellipse
              cx={domeCx}
              cy={domeCy + 75 * s}
              rx={60 * s}
              ry={25 * s}
              fill="rgba(255,255,255,0.06)"
            />

            {/* Gate indicator */}
            <AnimatedSvgRect
              x={HOLE_CX * s - HOLE_HALF_W * s}
              y={HOLE_Y * s - 4 * s}
              width={HOLE_HALF_W * 2 * s}
              height={8 * s}
              fill={MACHINE.gate}
              animatedProps={gateProps}
            />

            {/* Chute (fill + stroke combined) */}
            <AnimatedSvgPath
              fill={MACHINE.chute}
              stroke={MACHINE.chuteStroke}
              strokeWidth={1.5}
              animatedProps={chutePathProps}
            />

            {/* Dial */}
            <SvgCircle cx={W / 2} cy={DIAL_Y * s} r={32 * s} fill={MACHINE.dialBody} />
            <SvgCircle
              cx={W / 2}
              cy={DIAL_Y * s}
              r={32 * s}
              stroke={MACHINE.dialStroke}
              fill="none"
              strokeWidth={2}
            />
            {/* Knob */}
            <SvgCircle cx={W / 2} cy={DIAL_Y * s - 23 * s} r={8 * s} fill={MACHINE.dialHighlight} />
            <SvgCircle cx={W / 2 - s} cy={DIAL_Y * s - 22 * s} r={3 * s} fill={MACHINE.dialKnob} />
            {/* Crosshair */}
            <SvgLine
              x1={W / 2 - 9 * s}
              y1={DIAL_Y * s}
              x2={W / 2 + 9 * s}
              y2={DIAL_Y * s}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={2}
            />
            <SvgLine
              x1={W / 2}
              y1={DIAL_Y * s - 9 * s}
              x2={W / 2}
              y2={DIAL_Y * s + 9 * s}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={2}
            />

            {/* Base feet */}
            <SvgRect
              x={BODY_L * s + 18 * s}
              y={BODY_B * s}
              width={28 * s}
              height={22 * s}
              rx={3 * s}
              ry={3 * s}
              fill={MACHINE.body}
            />
            <SvgRect
              x={BODY_R * s - 46 * s}
              y={BODY_B * s}
              width={28 * s}
              height={22 * s}
              rx={3 * s}
              ry={3 * s}
              fill={MACHINE.body}
            />

            {/* Escaped balls (not clipped to dome) */}
            {ballIndices.map((i) => (
              <AnimatedBall
                key={`esc-${i}`}
                index={i}
                ballData={physics.ballData}
                showWhenEscaped
                r={ballR}
              />
            ))}

            {/* Shell fragment pieces */}
            {particles.shells.map((sh, i) => (
              <SvgCircle
                key={`shell-${i}`}
                cx={sh.x}
                cy={sh.y}
                r={sh.size}
                fill={sh.colorIdx < 0 ? '#FFFFFF' : BALL_COLORS[sh.colorIdx % BALL_COLORS.length]}
                opacity={sh.alpha}
              />
            ))}

            {/* Sparkles — cross-shaped rarity-colored particles */}
            {particles.sparkles.map((sk, i) => {
              const sz = sk.size * sk.life;
              const arm = sz * 1.8;
              const sparkColor = RARITY_GLOW_CSS[sk.rarityIdx] ?? RARITY_GLOW_CSS[0];
              return (
                <G key={`spark-${i}`} opacity={sk.life}>
                  <SvgCircle cx={sk.x} cy={sk.y} r={sz * 0.5} fill={sparkColor} />
                  <SvgLine
                    x1={sk.x - arm}
                    y1={sk.y}
                    x2={sk.x + arm}
                    y2={sk.y}
                    stroke={sparkColor}
                    strokeWidth={1}
                  />
                  <SvgLine
                    x1={sk.x}
                    y1={sk.y - arm}
                    x2={sk.x}
                    y2={sk.y + arm}
                    stroke={sparkColor}
                    strokeWidth={1}
                  />
                </G>
              );
            })}
          </Svg>

          {/* Flash overlay */}
          <Animated.View style={[StyleSheet.absoluteFill, flashStyle, styles.flashOverlay]} />

          <Text style={labelStyle}>{drawType === 'golden' ? '★ GOLDEN GACHA ★' : '✦ GACHA ✦'}</Text>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  flashOverlay: {
    backgroundColor: colors.surface,
    pointerEvents: 'none',
  },
});

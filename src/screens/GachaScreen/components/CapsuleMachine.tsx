/**
 * CapsuleMachine — Skia Canvas 扭蛋机渲染组件
 *
 * 使用 useDerivedValue + Picture API 在 UI 线程渲染整个场景：
 * 背景、机身、玻璃罩、28 颗球、管道、旋钮、地面、闪光。
 * 物理状态来自 useGachaPhysics 的 shared values。
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { forwardRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import {
  BALL_COLORS,
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

// ─── Pre-allocated Skia resources ───────────────────────────────────────
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const strokePaint = Skia.Paint();
strokePaint.setStyle(1); // Stroke

// Pre-convert ball colors to Skia format
const SKIA_BALL_COLORS = BALL_COLORS.map((c) => Skia.Color(c));
const SKIA_WHITE = Skia.Color('#e0e0e0');
const SKIA_WHITE_FAINT = Skia.Color('rgba(255,255,255,0.2)');
const SKIA_WHITE_HIGHLIGHT = Skia.Color('rgba(255,255,255,0.3)');
const SKIA_BG = Skia.Color(MACHINE.bg);
const SKIA_BG_LIGHT = Skia.Color(MACHINE.bgLight);
const SKIA_BODY = Skia.Color(MACHINE.body);
const SKIA_BODY_MID = Skia.Color(MACHINE.bodyMid);
const SKIA_DOME_FILL = Skia.Color(MACHINE.dome);
const SKIA_DOME_STROKE = Skia.Color(MACHINE.domeStroke);
const SKIA_CHUTE = Skia.Color(MACHINE.chute);
const SKIA_FLOOR_FILL = Skia.Color(MACHINE.floor);
const SKIA_FLOOR_LINE = Skia.Color(MACHINE.floorLine);
const SKIA_SHADOW = Skia.Color(MACHINE.shadow);
const SKIA_GATE = Skia.Color(MACHINE.gate);
const SKIA_DIAL_BODY = Skia.Color(MACHINE.dialBody);
const SKIA_DIAL_HIGHLIGHT = Skia.Color(MACHINE.dialHighlight);
const SKIA_DIAL_KNOB = Skia.Color(MACHINE.dialKnob);
const SKIA_DIAL_STROKE = Skia.Color(MACHINE.dialStroke);

// Rarity glow colors (indexed 0-3: common, rare, epic, legendary)
const RARITY_GLOW_COLORS = [
  Skia.Color('rgba(158,158,158,0.5)'),
  Skia.Color('rgba(74,144,217,0.6)'),
  Skia.Color('rgba(155,89,182,0.7)'),
  Skia.Color('rgba(245,166,35,0.8)'),
];

// Pre-allocated colors used inside scenePicture worklet
const SKIA_BALL_CENTER_LINE = Skia.Color('rgba(0,0,0,0.15)');
const SKIA_DOME_HIGHLIGHT_L = Skia.Color('rgba(255,255,255,0.13)');
const SKIA_DOME_HIGHLIGHT_R = Skia.Color('rgba(255,255,255,0.07)');
const SKIA_CROSSHAIR = Skia.Color('rgba(255,255,255,0.12)');
const SKIA_BODY_EDGE = Skia.Color(MACHINE.bodyEdge);
const SKIA_CHUTE_STROKE = Skia.Color(MACHINE.chuteStroke);
const SKIA_GLOW_CENTER = Skia.Color('rgba(255,255,255,0.8)');
const SKIA_FLASH = Skia.Color('#FFFFFF');
const SKIA_DOME_BOTTOM_ARC = Skia.Color('rgba(255,255,255,0.06)');

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

// ─── Component ──────────────────────────────────────────────────────────

export const CapsuleMachine = forwardRef<CapsuleMachineRef, CapsuleMachineProps>(
  function CapsuleMachine({ width, height, drawType, onPhaseChange }, ref) {
    const scale = width / REF_W;
    const s = scale;
    const canvasH = Math.min(height, REF_H * s);

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

    // ── Skia scene picture ────────────────────────────────────────────
    const scenePicture = useDerivedValue(() => {
      'worklet';
      // Subscribe to render tick
      void physics.renderTick.value;

      const W = width;
      const H = canvasH;
      const c = recorder.beginRecording(Skia.XYWHRect(0, 0, W, H));

      // Background
      paint.setColor(SKIA_BG);
      c.drawRect(Skia.XYWHRect(0, 0, W, H), paint);
      // Radial glow behind dome — outer ring (purple tint)
      paint.setColor(SKIA_BG_LIGHT);
      paint.setAlphaf(0.2);
      c.drawCircle(W / 2, H * 0.32, H * 0.55, paint);
      // Mid ring (brighter)
      paint.setAlphaf(0.35);
      c.drawCircle(W / 2, H * 0.32, H * 0.35, paint);
      // Inner glow
      paint.setAlphaf(0.15);
      c.drawCircle(W / 2, H * 0.32, H * 0.2, paint);
      paint.setAlphaf(1);

      // Floor area
      paint.setColor(SKIA_FLOOR_FILL);
      c.drawRect(Skia.XYWHRect(0, FLOOR_Y * s, W, H - FLOOR_Y * s), paint);
      strokePaint.setColor(SKIA_FLOOR_LINE);
      strokePaint.setStrokeWidth(1);
      c.drawLine(30 * s, FLOOR_Y * s, W - 30 * s, FLOOR_Y * s, strokePaint);

      // Machine shadow
      paint.setColor(SKIA_SHADOW);
      c.drawOval(Skia.XYWHRect(W / 2 - 148 * s, BODY_B * s + 10 * s, 296 * s, 28 * s), paint);

      // Machine body
      const bodyRect = Skia.RRectXY(
        Skia.XYWHRect(BODY_L * s, BODY_T * s, (BODY_R - BODY_L) * s, (BODY_B - BODY_T) * s),
        6 * s,
        6 * s,
      );
      paint.setColor(SKIA_BODY_MID);
      c.drawRRect(bodyRect, paint);
      strokePaint.setColor(SKIA_BODY_EDGE);
      strokePaint.setStrokeWidth(2);
      c.drawRRect(bodyRect, strokePaint);

      // Glass dome fill + stroke
      const domeCx = DOME_CX * s;
      const domeCy = DOME_CY * s;
      const domeR = DOME_R * s;

      // Draw balls INSIDE dome (clip to dome circle)
      c.save();
      const domePath = Skia.Path.Make();
      domePath.addCircle(domeCx, domeCy, domeR);
      c.clipPath(domePath, 1, true); // Intersect
      const data = physics.ballData.value;
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE;
        const flags = data[base + 5];
        if ((flags & F_ESCAPED) !== 0 || (flags & F_OPENED) !== 0) continue;
        const bx = data[base];
        const by = data[base + 1];
        const r = data[base + 4];
        // Top half (colored)
        paint.setColor(SKIA_BALL_COLORS[i % SKIA_BALL_COLORS.length]);
        c.drawArc(Skia.XYWHRect(bx - r, by - r, r * 2, r * 2), 180, 180, true, paint);
        // Bottom half (white)
        paint.setColor(SKIA_WHITE);
        c.drawArc(Skia.XYWHRect(bx - r, by - r, r * 2, r * 2), 0, 180, true, paint);
        // Center line
        strokePaint.setColor(SKIA_BALL_CENTER_LINE);
        strokePaint.setStrokeWidth(1.5);
        c.drawLine(bx - r, by, bx + r, by, strokePaint);
        // Highlight
        paint.setColor(SKIA_WHITE_HIGHLIGHT);
        c.drawCircle(bx - r * 0.28, by - r * 0.35, r * 0.22, paint);
        // Ring
        strokePaint.setColor(SKIA_WHITE_FAINT);
        strokePaint.setStrokeWidth(1.5);
        c.drawCircle(bx, by - r * 0.08, r * 0.28, strokePaint);
      }
      c.restore();

      // Dome outline + glass effect
      strokePaint.setColor(SKIA_DOME_STROKE);
      strokePaint.setStrokeWidth(3);
      c.drawCircle(domeCx, domeCy, domeR, strokePaint);
      // Glass fill
      paint.setColor(SKIA_DOME_FILL);
      c.drawCircle(domeCx, domeCy, domeR, paint);
      // Left arc highlight
      paint.setColor(SKIA_DOME_HIGHLIGHT_L);
      c.drawOval(Skia.XYWHRect(domeCx - 71 * s, domeCy - 87 * s, 32 * s, 144 * s), paint);
      // Top-right small highlight
      paint.setColor(SKIA_DOME_HIGHLIGHT_R);
      c.drawOval(Skia.XYWHRect(domeCx + 35 * s, domeCy - 77 * s, 20 * s, 44 * s), paint);
      // Bottom reflection arc
      paint.setColor(SKIA_DOME_BOTTOM_ARC);
      c.drawOval(Skia.XYWHRect(domeCx - 60 * s, domeCy + 50 * s, 120 * s, 50 * s), paint);

      // Gate indicator
      if (physics.gateOpen.value === 1) {
        paint.setColor(SKIA_GATE);
        c.drawRect(
          Skia.XYWHRect(
            HOLE_CX * s - HOLE_HALF_W * s,
            HOLE_Y * s - 4 * s,
            HOLE_HALF_W * 2 * s,
            8 * s,
          ),
          paint,
        );
      }

      // Chute
      const chuteHW = physics.gateOpen.value === 1 ? 40 * s : 28 * s;
      const chutePath = Skia.Path.Make();
      chutePath.moveTo(W / 2 - chuteHW, CHUTE_TOP * s);
      chutePath.lineTo(W / 2 - chuteHW + 4 * s, CHUTE_BOT * s);
      chutePath.quadTo(W / 2, CHUTE_BOT * s + 12 * s, W / 2 + chuteHW - 4 * s, CHUTE_BOT * s);
      chutePath.lineTo(W / 2 + chuteHW, CHUTE_TOP * s);
      chutePath.close();
      paint.setColor(SKIA_CHUTE);
      c.drawPath(chutePath, paint);
      strokePaint.setColor(SKIA_CHUTE_STROKE);
      strokePaint.setStrokeWidth(1.5);
      c.drawPath(chutePath, strokePaint);

      // Dial
      const dialX = W / 2;
      const dialY = DIAL_Y * s;
      const dialR = 32 * s;
      paint.setColor(SKIA_DIAL_BODY);
      c.drawCircle(dialX, dialY, dialR, paint);
      strokePaint.setColor(SKIA_DIAL_STROKE);
      strokePaint.setStrokeWidth(2);
      c.drawCircle(dialX, dialY, dialR, strokePaint);
      // Knob
      paint.setColor(SKIA_DIAL_HIGHLIGHT);
      c.drawCircle(dialX, dialY - 23 * s, 8 * s, paint);
      paint.setColor(SKIA_DIAL_KNOB);
      c.drawCircle(dialX - 1 * s, dialY - 22 * s, 3 * s, paint);
      // Crosshair
      strokePaint.setColor(SKIA_CROSSHAIR);
      strokePaint.setStrokeWidth(2);
      c.drawLine(dialX - 9 * s, dialY, dialX + 9 * s, dialY, strokePaint);
      c.drawLine(dialX, dialY - 9 * s, dialX, dialY + 9 * s, strokePaint);

      // Base feet
      paint.setColor(SKIA_BODY);
      c.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(BODY_L * s + 18 * s, BODY_B * s, 28 * s, 22 * s), 3 * s, 3 * s),
        paint,
      );
      c.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(BODY_R * s - 46 * s, BODY_B * s, 28 * s, 22 * s), 3 * s, 3 * s),
        paint,
      );

      // Escaped balls (in chute + on floor)
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE;
        const flags = data[base + 5];
        if ((flags & F_ESCAPED) === 0 || (flags & F_OPENED) !== 0) continue;
        const bx = data[base];
        const by = data[base + 1];
        const r = data[base + 4];
        // Top half
        paint.setColor(SKIA_BALL_COLORS[i % SKIA_BALL_COLORS.length]);
        c.drawArc(Skia.XYWHRect(bx - r, by - r, r * 2, r * 2), 180, 180, true, paint);
        // Bottom half
        paint.setColor(SKIA_WHITE);
        c.drawArc(Skia.XYWHRect(bx - r, by - r, r * 2, r * 2), 0, 180, true, paint);
        // Center line
        strokePaint.setColor(SKIA_BALL_CENTER_LINE);
        strokePaint.setStrokeWidth(1.5);
        c.drawLine(bx - r, by, bx + r, by, strokePaint);
        // Highlight
        paint.setColor(SKIA_WHITE_HIGHLIGHT);
        c.drawCircle(bx - r * 0.28, by - r * 0.35, r * 0.22, paint);
        // Ring
        strokePaint.setColor(SKIA_WHITE_FAINT);
        strokePaint.setStrokeWidth(1.5);
        c.drawCircle(bx, by - r * 0.08, r * 0.28, strokePaint);
      }

      // Opened ball positions — rarity glow circles
      const ob = physics.openedBalls.value;
      for (let i = 0; i < ob.length; i += 3) {
        const ox = ob[i];
        const oy = ob[i + 1];
        const rar = ob[i + 2];
        const glowColor = RARITY_GLOW_COLORS[rar] ?? RARITY_GLOW_COLORS[0];
        paint.setColor(glowColor);
        c.drawCircle(ox, oy, 20 * s, paint);
        // White center dot
        paint.setColor(SKIA_GLOW_CENTER);
        c.drawCircle(ox, oy, 4 * s, paint);
      }

      // Flash overlay
      const fa = physics.flashAlpha.value;
      if (fa > 0.01) {
        paint.setColor(SKIA_FLASH);
        paint.setAlphaf(fa);
        c.drawRect(Skia.XYWHRect(0, 0, W, H), paint);
        paint.setAlphaf(1);
      }

      return recorder.finishRecordingAsPicture();
    });

    // ── Animated styles for shake ──────────────────────────────────────
    const shakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: physics.shakeX.value }, { translateY: physics.shakeY.value }],
    }));

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
      <View style={[styles.container, { width, height: canvasH }]}>
        <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
          <Canvas style={{ width, height: canvasH }}>
            <Picture picture={scenePicture} />
          </Canvas>
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
});

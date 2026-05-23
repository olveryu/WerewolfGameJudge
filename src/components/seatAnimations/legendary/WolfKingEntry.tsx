/**
 * WolfKingEntry — 狼王登场 (Skia Canvas + Picture)
 *
 * Legendary entrance: glowing wolf-eye pupils appear, claw slashes form an X,
 * then a blood-red shockwave reveals the avatar with a zoom-in.
 * All overlay effects rendered in a single Picture worklet.
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';

const PHASE1 = LEGENDARY_DURATION * 0.36; // eyes appear
const PHASE2 = LEGENDARY_DURATION * 0.32; // claw slashes
const PHASE3 = LEGENDARY_DURATION * 0.32; // shockwave + reveal

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

const EYE_COLOR = Skia.Color('rgb(255,50,50)');
const SLASH_COLOR = Skia.Color('rgb(200,30,30)');
const WAVE_COLOR = Skia.Color('rgb(180,20,20)');

export const WolfKingEntry = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const eyeGlow = useSharedValue(0);
    const slashProgress = useSharedValue(0);
    const waveProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      eyeGlow.value = withSequence(
        withTiming(1, { duration: PHASE1 * 0.6 }),
        withTiming(0.5, { duration: PHASE1 * 0.4 }),
      );
      slashProgress.value = withDelay(
        PHASE1,
        withTiming(1, { duration: PHASE2, easing: Easing.out(Easing.quad) }),
      );
      waveProgress.value = withDelay(
        PHASE1 + PHASE2,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }),
      );
      childOpacity.value = withDelay(
        PHASE1 + PHASE2 * 0.5,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }, (f) => {
          if (f) scheduleOnRN(onComplete);
        }),
      );
    }, [eyeGlow, slashProgress, waveProgress, childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.5 + childOpacity.value * 0.5 }],
    }));

    const canvasStyle = useMemo(
      () => ({ width: size, height: size, ...StyleSheet.absoluteFillObject }),
      [size],
    );

    const effectPicture = useDerivedValue(() => {
      'worklet';
      const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

      // ── Eyes ──
      const eyeOp = eyeGlow.value * 0.9;
      if (eyeOp > 0) {
        paint.setColor(EYE_COLOR);
        paint.setAlphaf(eyeOp);
        c.drawCircle(size * 0.38, size * 0.38, size * 0.03, paint);
        c.drawCircle(size * 0.62, size * 0.38, size * 0.03, paint);
      }

      // ── Claw slashes ──
      const sp = slashProgress.value;
      const wp = waveProgress.value;
      if (sp > 0) {
        const slashOp = (1 - wp) * 0.7;
        if (slashOp > 0) {
          paint.setColor(SLASH_COLOR);
          paint.setAlphaf(slashOp);
          paint.setStyle(1);
          paint.setStrokeWidth(3);
          paint.setStrokeCap(1);

          // Slash 1: top-left to bottom-right
          const x1 = size * 0.15;
          const y1 = size * 0.15;
          path.reset();
          path.moveTo(x1, y1);
          path.lineTo(x1 + sp * size * 0.7, y1 + sp * size * 0.7);
          c.drawPath(path, paint);

          // Slash 2: top-right to bottom-left
          const x2 = size * 0.85;
          const y2 = size * 0.15;
          path.reset();
          path.moveTo(x2, y2);
          path.lineTo(x2 - sp * size * 0.7, y2 + sp * size * 0.7);
          c.drawPath(path, paint);

          paint.setStyle(0);
          paint.setStrokeWidth(0);
        }
      }

      // ── Shockwave ──
      if (wp > 0) {
        paint.setColor(WAVE_COLOR);
        paint.setAlphaf((1 - wp) * 0.4);
        paint.setStyle(1);
        paint.setStrokeWidth(2);
        c.drawCircle(size / 2, size / 2, wp * size * 0.55, paint);
        paint.setStyle(0);
        paint.setStrokeWidth(0);
      }

      paint.setAlphaf(1);
      return recorder.finishRecordingAsPicture();
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Canvas style={canvasStyle}>
          <Picture picture={effectPicture} />
        </Canvas>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
WolfKingEntry.displayName = 'WolfKingEntry';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});

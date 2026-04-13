/**
 * FireflyFlair — 萤火虫之夜
 *
 * 8 只萤火虫在外围不规则游走，明暗闪烁节奏错开，带暖色辉光晕。
 * Skia Immediate Mode。
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { FlairProps } from './FlairProps';

const N = 8;

export const FireflyFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.32 + (i % 4) * 0.05,
        phase: i / N,
        wander: 0.15 + (i % 3) * 0.08,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const angle =
        s.angle0 + Math.sin((t * 1.5 + s.phase * 7) * Math.PI) * s.wander + t * Math.PI * 0.3;
      const dist = s.dist * size + Math.sin((t * 2.5 + s.phase * 5) * Math.PI) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      // Sharp blink rhythm
      const blink = Math.max(0, Math.sin((t * 4 + s.phase * 8) * Math.PI));
      const alpha = 0.1 + blink * 0.7;

      // Warm glow halo (larger, dimmer)
      paint.setColor(Skia.Color(`rgba(200,230,60,${(alpha * 0.25).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.03, paint);

      // Bright core
      paint.setColor(Skia.Color(`rgba(230,255,100,${(alpha * 0.9).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.012, paint);
    }

    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
});
FireflyFlair.displayName = 'FireflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});

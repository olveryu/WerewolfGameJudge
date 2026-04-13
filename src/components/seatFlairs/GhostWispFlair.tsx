/**
 * GhostWispFlair — 幽灵鬼火
 *
 * 5 团蓝白色鬼火在外围不规则游走，带 3 节拖尾和辉光晕。
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

const N = 5;
const TAIL = 3;

export const GhostWispFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2,
        phase: i / N,
        orbitR: 0.3 + (i % 3) * 0.06,
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
      const angle = s.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + s.phase * 10) * 0.3;
      const dist = s.orbitR * size + Math.sin(t * Math.PI * 3 + s.phase * 8) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + s.phase * 6) * Math.PI));

      // Outer glow halo
      paint.setColor(Skia.Color(`rgba(100,200,255,${(pulse * 0.25).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.04, paint);

      // Core
      paint.setColor(Skia.Color(`rgba(180,230,255,${(pulse * 0.9).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.018, paint);

      // Tail dots
      for (let j = 1; j <= TAIL; j++) {
        const ta = angle - j * 0.15;
        const td = dist - j * 2;
        const tx = cx + Math.cos(ta) * td;
        const ty = cy + Math.sin(ta) * td;
        const tailAlpha = Math.max(0, pulse * (0.4 - j * 0.1));
        paint.setColor(Skia.Color(`rgba(100,200,255,${tailAlpha.toFixed(2)})`));
        c.drawCircle(tx, ty, size * (0.014 - j * 0.003), paint);
      }
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
GhostWispFlair.displayName = 'GhostWispFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});

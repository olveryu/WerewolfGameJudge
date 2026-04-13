/**
 * CometTailFlair — 彗星拖尾
 *
 * 3 颗彗星在外围环绕，每颗带 8 节渐隐拖尾。
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

const COMET_COUNT = 3;
const TRAIL_LEN = 8;

export const CometTailFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: COMET_COUNT }, (_, i) => ({
        angle0: (i / COMET_COUNT) * Math.PI * 2,
        phase: i / COMET_COUNT,
        speed: 0.5 + i * 0.15,
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
    const orbit = size * 0.4;
    const t = progress.value;

    for (let i = 0; i < COMET_COUNT; i++) {
      const s = seeds[i];
      const angle = s.angle0 + t * s.speed * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin((t * 4 + s.phase * 6) * Math.PI);

      // Tail dots (draw back-to-front)
      for (let j = TRAIL_LEN; j >= 0; j--) {
        const ta = angle - j * 0.12;
        const td = orbit + j * 1;
        const tx = cx + Math.cos(ta) * td;
        const ty = cy + Math.sin(ta) * td;
        const r = j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
        const alpha = j === 0 ? pulse * 0.85 : Math.max(0, pulse * (0.5 - j * 0.05));
        paint.setColor(Skia.Color(`rgba(180,200,255,${alpha.toFixed(2)})`));
        c.drawCircle(tx, ty, r, paint);
      }

      // Head glow
      const headX = cx + Math.cos(angle) * orbit;
      const headY = cy + Math.sin(angle) * orbit;
      paint.setColor(Skia.Color(`rgba(220,235,255,${(pulse * 0.3).toFixed(2)})`));
      c.drawCircle(headX, headY, size * 0.03, paint);
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
CometTailFlair.displayName = 'CometTailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});

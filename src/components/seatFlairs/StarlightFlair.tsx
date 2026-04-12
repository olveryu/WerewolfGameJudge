/**
 * StarlightFlair — 星光点缀
 *
 * 6 颗四芒星在头像周围漂浮，每颗用 drawLine 绘制十字+对角光芒，
 * 底层光晕圆。大小充足、始终半透明可见，明灭闪烁。
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

const N = 6;

export const StarlightFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.35 + (i % 3) * 0.05,
        phase: i / N,
        drift: 0.4 + (i % 4) * 0.25,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1.2);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const armLen = size * 0.05;
    const diagLen = armLen * 0.55;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const angle = s.angle0 + progress.value * Math.PI * 2 * s.drift;
      const d = s.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;

      // Twinkle: sine wave, min 0.3
      const t = (progress.value + s.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));

      // Glow halo (soft, larger)
      paint.setStrokeWidth(1.2);
      paint.setColor(Skia.Color(`rgba(255,250,200,${(tw * 0.15).toFixed(2)})`));
      c.drawCircle(x, y, armLen * 0.9, paint);

      // Cross arms (+)
      paint.setColor(Skia.Color(`rgba(255,253,224,${(tw * 0.8).toFixed(2)})`));
      paint.setStrokeWidth(1.5);
      c.drawLine(x - armLen, y, x + armLen, y, paint);
      c.drawLine(x, y - armLen, x, y + armLen, paint);

      // Diagonal arms (×) — shorter and dimmer
      paint.setColor(Skia.Color(`rgba(255,253,224,${(tw * 0.5).toFixed(2)})`));
      paint.setStrokeWidth(1);
      c.drawLine(x - diagLen, y - diagLen, x + diagLen, y + diagLen, paint);
      c.drawLine(x - diagLen, y + diagLen, x + diagLen, y - diagLen, paint);

      // Bright center dot
      paint.setColor(Skia.Color(`rgba(255,255,240,${(tw * 0.9).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.008, paint);
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
StarlightFlair.displayName = 'StarlightFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});

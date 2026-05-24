/**
 * ResilientCanvas — Skia Canvas wrapper with WebGL context-loss recovery.
 *
 * Problem: WeChat/Android WebView reclaims WebGL contexts on viewport resize.
 * Skia's WebGLRenderer.onResize() then calls CanvasKit.MakeWebGLCanvasSurface
 * which invokes gl.getShaderPrecisionFormat() on a lost context → returns null
 * → WASM dereferences .rangeMin → TypeError crash.
 *
 * Solution: listen for the standard `webglcontextlost` event on the underlying
 * <canvas> DOM element. When fired, increment a React key to force-remount the
 * Canvas — creating a fresh WebGL context. Animations resume automatically.
 * No static mode, no sacrificed functionality.
 */
import type { CanvasProps } from '@shopify/react-native-skia';
import { Canvas } from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  contents: { display: 'contents' as never },
});

export const ResilientCanvas: React.FC<CanvasProps> = ({ children, ...props }) => {
  const [epoch, setEpoch] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observedCanvas = useRef<HTMLCanvasElement | null>(null);

  const handleContextLost = useCallback((e: Event) => {
    e.preventDefault();
    setEpoch((v) => v + 1);
  }, []);

  const attachContextLostListener = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up previous listener
      if (observedCanvas.current) {
        observedCanvas.current.removeEventListener('webglcontextlost', handleContextLost);
        observedCanvas.current = null;
      }

      containerRef.current = node;
      if (!node) return;

      const canvas = node.querySelector('canvas');
      if (!canvas) return;

      canvas.addEventListener('webglcontextlost', handleContextLost);
      observedCanvas.current = canvas;
    },
    [handleContextLost],
  );

  if (Platform.OS !== 'web') {
    return <Canvas {...props}>{children}</Canvas>;
  }

  return (
    <div ref={attachContextLostListener} style={styles.contents}>
      <Canvas key={epoch} {...props}>
        {children}
      </Canvas>
    </div>
  );
};

/**
 * ResilientCanvas — Skia Canvas wrapper with WebGL context lifecycle management.
 *
 * Web browsers impose a limit of 16 WebGL contexts per page. When exceeded,
 * the oldest context is forcibly reclaimed mid-render, causing CanvasKit to
 * dereference null from gl.getShaderPrecisionFormat() → TypeError (.rangeMin)
 * or WASM Aborted() crashes.
 *
 * Solution: `__destroyWebGLContextAfterRender` releases the WebGL context
 * after each frame is painted to the <canvas> element. Animations remain
 * visible (context is recreated on the next frame). At any moment, at most
 * one context is active across all ResilientCanvas instances — eliminating
 * context exhaustion entirely.
 *
 * The `webglcontextlost` listener is retained as a safety net for edge cases
 * (tab backgrounding, OS memory pressure) where the browser reclaims a context
 * between the create→render→destroy cycle.
 *
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web
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
      <Canvas key={epoch} __destroyWebGLContextAfterRender {...props}>
        {children}
      </Canvas>
    </div>
  );
};

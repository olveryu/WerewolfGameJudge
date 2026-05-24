/**
 * FlairStaticContext — 控制 Skia Canvas 渲染模式
 *
 * static=true: 不启动动画循环，Canvas 使用 StaticWebGLRenderer
 * （不持有 persistent WebGL context → resize 不触发 MakeWebGLCanvasSurface）。
 * 用于 Settings/Appearance 等非游戏预览场景。
 *
 * StaticCanvas 是项目中所有 Skia 动画组件的统一 Canvas 入口：
 * 内部自动读取 context 并传递 __destroyWebGLContextAfterRender，
 * 确保新增 Skia 组件无需手动记忆传 prop。
 */
import type { CanvasProps } from '@shopify/react-native-skia';
import { Canvas } from '@shopify/react-native-skia';
import type React from 'react';
import { createContext, useContext } from 'react';

export const FlairStaticContext = createContext(false);

/** Returns true when the flair should render a single static frame (no animation). */
export const useFlairStatic = (): boolean => useContext(FlairStaticContext);

/**
 * StaticCanvas — Canvas wrapper that auto-applies __destroyWebGLContextAfterRender
 * based on FlairStaticContext. All Skia animation components should use this
 * instead of raw Canvas to structurally prevent WebGL context-loss crashes in
 * preview screens.
 */
export const StaticCanvas: React.FC<CanvasProps> = ({ children, ...props }) => {
  const isStatic = useFlairStatic();
  return (
    <Canvas {...props} __destroyWebGLContextAfterRender={isStatic}>
      {children}
    </Canvas>
  );
};

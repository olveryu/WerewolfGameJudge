/**
 * FlairStaticContext — 控制 Skia flair 渲染模式
 *
 * static=true: 不启动动画循环，Canvas 使用 StaticWebGLRenderer
 * （不持有 persistent WebGL context → resize 不触发 MakeWebGLCanvasSurface）。
 * 用于 Settings/Appearance hero preview 等非游戏场景。
 */
import { createContext, useContext } from 'react';

export const FlairStaticContext = createContext(false);

/** Returns true when the flair should render a single static frame (no animation). */
export const useFlairStatic = (): boolean => useContext(FlairStaticContext);

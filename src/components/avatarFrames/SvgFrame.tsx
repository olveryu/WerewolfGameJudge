/**
 * SvgFrame — 通用静态 SVG 头像框渲染器
 *
 * 接收一个 SVG 字符串构建函数，将结果编码为 data URL 并用 Image 展示。
 * SVG data URL 是矢量的，任意缩放无损。不依赖 react-native-svg。
 * Image 由 RN 原生渲染 — 无 WebView、无 Canvas、零动画开销。
 */
import { memo, useMemo } from 'react';
import { Image } from 'react-native';

import type { FrameProps } from './FrameProps';

interface SvgFrameProps extends FrameProps {
  /** 返回完整 SVG 标记字符串的函数。仅依赖 rx（size 由 viewBox 缩放处理）。 */
  buildSvg: (rx: number) => string;
}

export const SvgFrame = memo<SvgFrameProps>(({ size, rx, buildSvg }) => {
  const uri = useMemo(() => {
    const svg = buildSvg(rx);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [rx, buildSvg]);

  return <Image source={{ uri }} style={{ width: size, height: size }} />;
});
SvgFrame.displayName = 'SvgFrame';

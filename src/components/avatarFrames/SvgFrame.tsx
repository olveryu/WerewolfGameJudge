/**
 * SvgFrame — 通用静态 SVG 头像框渲染器
 *
 * 接收一个 SVG 字符串构建函数，用 inline SVG（dangerouslySetInnerHTML）渲染。
 * 渲染为真实 DOM <svg> 元素，支持 overflow:visible（与旧 react-native-svg 一致），
 * 确保 viewBox 外的装饰元素（闪电/辉光/粒子）不被裁切。
 * 不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';

interface SvgFrameProps extends FrameProps {
  /** 返回完整 SVG 标记字符串的函数。仅依赖 rx（size 由 viewBox 缩放处理）。 */
  buildSvg: (rx: number) => string;
}

export const SvgFrame = memo<SvgFrameProps>(({ size, rx, buildSvg }) => {
  const html = useMemo(() => {
    // Inject width/height/overflow into the root <svg> element so it fills
    // the container and allows decorative elements to extend past the viewBox.
    const raw = buildSvg(rx);
    const patched = raw.replace('<svg ', '<svg width="100%" height="100%" overflow="visible" ');
    return { __html: patched };
  }, [rx, buildSvg]);

  return (
    <div
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ width: size, height: size, overflow: 'visible', lineHeight: 0 }}
      dangerouslySetInnerHTML={html}
    />
  );
});
SvgFrame.displayName = 'SvgFrame';

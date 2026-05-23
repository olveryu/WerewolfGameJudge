/**
 * SvgFrame — 通用静态 SVG 头像框渲染器
 *
 * 渲染为 <svg> DOM 元素（同 react-native-svg 的 <Svg> 在 web 的渲染方式）。
 * 通过 dangerouslySetInnerHTML 注入 buildSvg 返回的 SVG 内部内容。
 * SVG 元素自身携带 width/height（px）+ viewBox，浏览器按 replaced element
 * 布局规则确定尺寸，不受 RN Web View 的 flex 默认值干扰。
 * 不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';

/** 匹配 <svg ...> 开标签和 </svg> 闭标签 */
const SVG_OPEN_RE = /^<svg[^>]*>/;
const SVG_CLOSE_RE = /<\/svg>\s*$/;

interface SvgFrameProps extends FrameProps {
  /** 返回完整 SVG 标记字符串的函数。仅依赖 rx（size 由 viewBox 缩放处理）。 */
  buildSvg: (rx: number) => string;
}

export const SvgFrame = memo<SvgFrameProps>(({ size, rx, buildSvg }) => {
  const innerHtml = useMemo(() => {
    const raw = buildSvg(rx);
    // 剥离外层 <svg> 标签，只保留内部内容（defs + shapes）
    const inner = raw.replace(SVG_OPEN_RE, '').replace(SVG_CLOSE_RE, '');
    return { __html: inner };
  }, [rx, buildSvg]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-8 -8 116 116"
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={innerHtml}
    />
  );
});
SvgFrame.displayName = 'SvgFrame';

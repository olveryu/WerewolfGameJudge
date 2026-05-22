/**
 * LegendaryShimmer — 传说头像框专属动效层
 *
 * 三层动效叠加：
 * 1. 环绕光弧（orbiting arc）：金色光弧沿边框轨道匀速旋转（两对光点对向运动）
 * 2. 外围脉冲辉光（glow pulse）：金色发光呼吸
 * 3. 角落星尘（corner sparkles）：四角交替闪烁的光点
 *
 * Canvas 2D + rAF 驱动 (expo DOM component)，不依赖 react-native-reanimated 或 react-native-svg。
 */
import { memo } from 'react';

import LegendaryShimmerCanvas from './LegendaryShimmerCanvas';

interface LegendaryShimmerProps {
  /** SVG 总尺寸（含 viewBox 外扩，= avatar size * 116/100） */
  size: number;
  /** 主边框圆角（viewBox 单位） */
  rx: number;
}

export const LegendaryShimmer = memo<LegendaryShimmerProps>(({ size, rx }) => (
  <LegendaryShimmerCanvas dom={{ matchContents: true }} size={size} rx={rx} />
));
LegendaryShimmer.displayName = 'LegendaryShimmer';

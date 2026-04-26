/**
 * LoopingSeatAnimation — 循环播放入座动画的预览包装器
 *
 * 入座动画组件设计为一次性播放（onComplete 后停止）。
 * 本组件通过 key 递增触发 React 重新挂载来实现循环播放，
 * 每轮之间有可配置的间隔。用于 AppearanceScreen / UnlocksScreen 的网格预览。
 */
import { memo, useCallback, useReducer, useRef } from 'react';
import { View } from 'react-native';

import type { SeatAnimationProps } from './SeatAnimationProps';

/** 每轮动画结束后的等待时间（ms） */
const DEFAULT_LOOP_DELAY = 800;

interface LoopingSeatAnimationProps {
  /** 要循环播放的动画组件 */
  Component: React.ComponentType<SeatAnimationProps>;
  /** 动画尺寸 */
  size: number;
  /** 圆角 */
  borderRadius: number;
  /** 子元素（动画包裹的内容） */
  children: React.ReactNode;
  /** 循环间隔 ms，默认 800 */
  loopDelay?: number;
}

export const LoopingSeatAnimation = memo<LoopingSeatAnimationProps>(
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React component prop requires PascalCase
  ({ Component, size, borderRadius, children, loopDelay = DEFAULT_LOOP_DELAY }) => {
    const [cycle, bump] = useReducer((n: number) => n + 1, 0);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const handleComplete = useCallback(() => {
      // Clear any pending timer to prevent stacking
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(bump, loopDelay);
    }, [loopDelay]);

    return (
      <View style={{ width: size, height: size }}>
        <Component key={cycle} size={size} borderRadius={borderRadius} onComplete={handleComplete}>
          {children}
        </Component>
      </View>
    );
  },
);

LoopingSeatAnimation.displayName = 'LoopingSeatAnimation';

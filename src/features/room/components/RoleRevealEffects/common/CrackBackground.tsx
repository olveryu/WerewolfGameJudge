/**
 * CrackBackground - 游戏无关的裂纹背景层。
 *
 * 从狼人杀 WolfCrackBackground 移植，仅改名（Wolf → 通用）。
 * primaryColor 已是 prop，调用方传入阵营色即可。
 * 在角色立绘后方渲染，模拟卡牌从内部裂开、能量光从裂纹泄漏。
 */
import { Blur, Canvas, Group, Path as SkiaPath, vec } from '@shopify/react-native-skia';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** 特效启动延迟（ms），与原版 CONFIG.alignmentEffects.effectStartDelay 一致 */
const EFFECT_START_DELAY = 100;

// Crack paths — jagged zigzag lines with branches (ratio coordinates 0–1)
const CRACK_MAIN = [
  'M 0.5 0.42 L 0.47 0.36 L 0.44 0.32 L 0.40 0.28 L 0.38 0.22 L 0.35 0.15 L 0.33 0.08',
  'M 0.5 0.42 L 0.53 0.37 L 0.57 0.33 L 0.60 0.27 L 0.63 0.20 L 0.66 0.12',
  'M 0.5 0.42 L 0.45 0.40 L 0.40 0.38 L 0.34 0.36 L 0.28 0.34 L 0.22 0.33',
  'M 0.5 0.42 L 0.55 0.41 L 0.60 0.39 L 0.66 0.40 L 0.72 0.38 L 0.78 0.37',
  'M 0.5 0.42 L 0.47 0.48 L 0.43 0.54 L 0.39 0.60 L 0.35 0.68 L 0.30 0.76',
  'M 0.5 0.42 L 0.54 0.47 L 0.58 0.53 L 0.62 0.60 L 0.67 0.68 L 0.72 0.78',
];
const CRACK_BRANCHES = [
  'M 0.44 0.32 L 0.41 0.30 L 0.37 0.29',
  'M 0.40 0.28 L 0.43 0.24 L 0.44 0.19',
  'M 0.57 0.33 L 0.60 0.31 L 0.64 0.30',
  'M 0.60 0.27 L 0.57 0.23 L 0.56 0.18',
  'M 0.40 0.38 L 0.38 0.42 L 0.34 0.44',
  'M 0.34 0.36 L 0.31 0.32 L 0.27 0.30',
  'M 0.60 0.39 L 0.62 0.43 L 0.66 0.45',
  'M 0.66 0.40 L 0.69 0.36 L 0.73 0.34',
  'M 0.43 0.54 L 0.40 0.56 L 0.36 0.55',
  'M 0.39 0.60 L 0.42 0.64 L 0.43 0.70',
  'M 0.58 0.53 L 0.61 0.55 L 0.65 0.54',
  'M 0.62 0.60 L 0.59 0.64 L 0.58 0.70',
];
const DEBRIS_CHIPS = [
  'M 0.42 0.29 L 0.46 0.26 L 0.41 0.26 Z',
  'M 0.38 0.23 L 0.42 0.20 L 0.36 0.21 Z',
  'M 0.57 0.30 L 0.61 0.27 L 0.56 0.28 Z',
  'M 0.61 0.23 L 0.65 0.20 L 0.60 0.21 Z',
  'M 0.37 0.36 L 0.41 0.33 L 0.36 0.34 Z',
  'M 0.62 0.37 L 0.66 0.34 L 0.61 0.35 Z',
  'M 0.41 0.54 L 0.45 0.51 L 0.40 0.52 Z',
  'M 0.58 0.54 L 0.62 0.51 L 0.57 0.52 Z',
];

interface CrackBackgroundProps {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly animate: boolean;
  readonly primaryColor: string;
}

export const CrackBackground: React.FC<CrackBackgroundProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
}) => {
  const crackSpread = useSharedValue(0);
  const crackOpacity = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    crackSpread.value = withDelay(
      EFFECT_START_DELAY + 100,
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
    );
    crackOpacity.value = withDelay(
      EFFECT_START_DELAY,
      withTiming(0.85, { duration: 1200, easing: Easing.out(Easing.quad) }),
    );
  }, [animate, crackSpread, crackOpacity]);

  const mainEnd = useDerivedValue(() => Math.min(1, crackSpread.value * 1.2));
  const branchEnd = useDerivedValue(() =>
    Math.max(0, Math.min(1, (crackSpread.value - 0.3) * 1.8)),
  );
  const debrisOp = useDerivedValue(() => Math.max(0, Math.min(0.7, (crackSpread.value - 0.4) * 2)));

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: cardWidth,
      height: cardHeight,
      pointerEvents: 'none' as const,
    }),
    [cardWidth, cardHeight],
  );

  return (
    <Canvas style={canvasStyle}>
      <Group
        opacity={crackOpacity}
        transform={[{ scaleX: cardWidth }, { scaleY: cardHeight }]}
        origin={vec(0, 0)}
      >
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-shadow-${i}`}
            path={pathStr}
            color="#1a0000"
            style="stroke"
            strokeWidth={6 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
            opacity={0.6}
          >
            <Blur blur={5 / cardWidth} />
          </SkiaPath>
        ))}
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-edge-${i}`}
            path={pathStr}
            color={primaryColor}
            style="stroke"
            strokeWidth={1.8 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
          >
            <Blur blur={0.3 / cardWidth} />
          </SkiaPath>
        ))}
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-glow-${i}`}
            path={pathStr}
            color="#661100"
            style="stroke"
            strokeWidth={0.8 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
            opacity={0.7}
          >
            <Blur blur={0.6 / cardWidth} />
          </SkiaPath>
        ))}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <SkiaPath
            key={`crack-b-edge-${i}`}
            path={pathStr}
            color={primaryColor}
            style="stroke"
            strokeWidth={1.0 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={branchEnd}
            opacity={0.6}
          >
            <Blur blur={0.3 / cardWidth} />
          </SkiaPath>
        ))}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <SkiaPath
            key={`crack-b-glow-${i}`}
            path={pathStr}
            color="#661100"
            style="stroke"
            strokeWidth={0.5 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={branchEnd}
            opacity={0.4}
          >
            <Blur blur={0.4 / cardWidth} />
          </SkiaPath>
        ))}
        <Group opacity={debrisOp}>
          {DEBRIS_CHIPS.map((chipPath, i) => (
            <SkiaPath key={`debris-${i}`} path={chipPath} color={primaryColor} opacity={0.9}>
              <Blur blur={0.3 / cardWidth} />
            </SkiaPath>
          ))}
        </Group>
      </Group>
    </Canvas>
  );
};

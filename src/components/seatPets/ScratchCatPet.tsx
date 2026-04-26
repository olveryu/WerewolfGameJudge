/**
 * ScratchCatPet — 刮刮猫
 *
 * scratch 翻牌动画的伴生宠物。
 * 奶黄小猫 + 三角耳 + 胡须 + 前爪挠金币，浮动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedEllipse } from './svgAnimatedPrimitives';

export const ScratchCatPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2800);
  const t = useLoop(1500);

  // Paw swipe — translateY + slight rotation
  const pawProps = useAnimatedProps(() => {
    'worklet';
    const v = t.value;
    const ty = -Math.sin(v * Math.PI * 2) * 3;
    return { cy: 46 + ty } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Body */}
        <Ellipse cx={36} cy={50} rx={14} ry={10} fill="#f5deb3" />
        {/* Head */}
        <Circle cx={36} cy={32} r={14} fill="#ffe4b5" />
        {/* Ears — outer */}
        <Polygon points="24,22 20,10 30,18" fill="#ffcc80" />
        <Polygon points="48,22 52,10 42,18" fill="#ffcc80" />
        {/* Ears — inner pink */}
        <Polygon points="25,21 22,13 29,18" fill="#ffb6c1" />
        <Polygon points="47,21 50,13 43,18" fill="#ffb6c1" />
        {/* Eyes */}
        <Ellipse cx={31} cy={30} rx={2.5} ry={3} fill="#2d4a1b" />
        <Ellipse cx={41} cy={30} rx={2.5} ry={3} fill="#2d4a1b" />
        <Circle cx={31.5} cy={29.5} r={0.8} fill="#fff" />
        <Circle cx={41.5} cy={29.5} r={0.8} fill="#fff" />
        {/* Nose + mouth */}
        <Ellipse cx={36} cy={35} rx={2} ry={1.5} fill="#ffb6c1" />
        <Path d="M34 36.5 Q36 38 38 36.5" stroke="#c48a6e" strokeWidth={0.8} fill="none" />
        {/* Whiskers */}
        <Line x1={18} y1={33} x2={28} y2={34} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={18} y1={36} x2={28} y2={36} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={54} y1={33} x2={44} y2={34} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={54} y1={36} x2={44} y2={36} stroke="#c4a882" strokeWidth={0.5} />
        {/* Paw with coin */}
        <AnimatedEllipse animatedProps={pawProps} cx={22} rx={5} ry={4} fill="#ffe4b5" />
        <Circle cx={18} cy={42} r={5} fill="#ffd700" stroke="#daa520" strokeWidth={1} />
        <SvgText x={18} y={44} textAnchor="middle" fontSize={6} fill="#b8860b" fontWeight="bold">
          ¥
        </SvgText>
      </Svg>
    </Animated.View>
  );
});
ScratchCatPet.displayName = 'ScratchCatPet';

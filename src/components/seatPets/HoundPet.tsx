/**
 * HoundPet — 猎犬
 *
 * roleHunt 翻牌动画的伴生宠物。
 * 棕色小猎犬 + 摇摆耳朵 + 放大镜 + 摇尾巴，浮动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedEllipse, AnimatedPath } from './svgAnimatedPrimitives';

export const HoundPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(3000);
  const t = useLoop(2000);

  // Ear wobble
  const leftEar = useAnimatedProps(() => {
    'worklet';
    const rot = -15 + Math.sin(t.value * Math.PI * 2) * 10;
    return { rotation: rot } as Record<string, number>;
  });
  const rightEar = useAnimatedProps(() => {
    'worklet';
    const rot = 15 + Math.sin(t.value * Math.PI * 2 + 0.6) * 10;
    return { rotation: rot } as Record<string, number>;
  });

  // Tail wag
  const tail = useAnimatedProps(() => {
    'worklet';
    const wag = Math.sin(t.value * Math.PI * 4) * 6;
    const endX = 56 + wag;
    return { d: `M52 46 Q58 38 ${endX} 44` } as { d: string };
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Body */}
        <Ellipse cx={36} cy={46} rx={16} ry={12} fill="#c4956a" />
        {/* Head */}
        <Circle cx={36} cy={30} r={14} fill="#d4a574" />
        {/* Ears */}
        <AnimatedEllipse
          animatedProps={leftEar}
          cx={24}
          cy={20}
          rx={5}
          ry={8}
          fill="#a67a52"
          origin="24, 20"
        />
        <AnimatedEllipse
          animatedProps={rightEar}
          cx={48}
          cy={20}
          rx={5}
          ry={8}
          fill="#a67a52"
          origin="48, 20"
        />
        {/* Eyes */}
        <Circle cx={31} cy={28} r={3} fill="#2d1b1b" />
        <Circle cx={41} cy={28} r={3} fill="#2d1b1b" />
        <Circle cx={32} cy={27} r={1} fill="#fff" />
        <Circle cx={42} cy={27} r={1} fill="#fff" />
        {/* Nose */}
        <Ellipse cx={36} cy={33} rx={3} ry={2} fill="#3d2b1b" />
        {/* Magnifying glass */}
        <Circle cx={52} cy={38} r={6} fill="none" stroke="#7b8fa8" strokeWidth={2} />
        <Circle cx={52} cy={38} r={4} fill="rgba(173,216,230,0.3)" />
        <Line
          x1={56}
          y1={42}
          x2={60}
          y2={48}
          stroke="#7b8fa8"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Tail */}
        <AnimatedPath
          animatedProps={tail}
          stroke="#c4956a"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
});
HoundPet.displayName = 'HoundPet';

/**
 * VortexEyePet — 漩涡眼
 *
 * vortexCollapse 翻牌动画的伴生宠物。
 * 深紫水滴体 + 触手摆动 + 大眼 + 漩涡虹膜持续旋转 + 瞳孔高光。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedG, AnimatedPath } from './svgAnimatedPrimitives';

export const VortexEyePet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2500);
  const tSpin = useLoop(3000);
  const tWobble = useLoop(2000);

  // Vortex iris spin
  const irisProps = useAnimatedProps(() => {
    'worklet';
    return { rotation: tSpin.value * 360 } as Record<string, number>;
  });

  // Tentacle wobble
  const tent1 = useAnimatedProps(() => {
    'worklet';
    const w = Math.sin(tWobble.value * Math.PI * 2) * 3;
    return { d: `M22 48 Q${18 + w} 56 ${22 + w} 58` } as { d: string };
  });
  const tent2 = useAnimatedProps(() => {
    'worklet';
    const w = Math.sin(tWobble.value * Math.PI * 2 + 0.6) * 3;
    return { d: `M28 50 Q${26 + w} 58 ${30 + w} 60` } as { d: string };
  });
  const tent3 = useAnimatedProps(() => {
    'worklet';
    const w = Math.sin(tWobble.value * Math.PI * 2 + 1.2) * 3;
    return { d: `M44 50 Q${46 + w} 58 ${42 + w} 60` } as { d: string };
  });
  const tent4 = useAnimatedProps(() => {
    'worklet';
    const w = Math.sin(tWobble.value * Math.PI * 2 + 1.8) * 3;
    return { d: `M50 48 Q${54 + w} 56 ${50 + w} 58` } as { d: string };
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Body blob */}
        <Ellipse cx={36} cy={40} rx={18} ry={14} fill="#4a148c" />
        {/* Tentacles */}
        <AnimatedPath
          animatedProps={tent1}
          stroke="#6a1b9a"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={tent2}
          stroke="#6a1b9a"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={tent3}
          stroke="#6a1b9a"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={tent4}
          stroke="#6a1b9a"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* Big eye */}
        <Circle cx={36} cy={36} r={12} fill="#e8e0f0" />
        <Circle cx={36} cy={36} r={10} fill="#fff" />
        {/* Vortex iris — spinning */}
        <AnimatedG animatedProps={irisProps} origin="36, 36">
          <Circle cx={36} cy={36} r={7} fill="#7b1fa2" />
          <Path d="M36 29 Q40 33 36 36 Q32 33 36 29" fill="#9c27b0" opacity={0.7} />
          <Path d="M43 36 Q39 40 36 36 Q39 32 43 36" fill="#9c27b0" opacity={0.7} />
          <Path d="M36 43 Q32 39 36 36 Q40 39 36 43" fill="#9c27b0" opacity={0.7} />
          <Path d="M29 36 Q33 32 36 36 Q33 40 29 36" fill="#9c27b0" opacity={0.7} />
        </AnimatedG>
        {/* Pupil */}
        <Circle cx={36} cy={36} r={3} fill="#1a1a2e" />
        <Circle cx={37} cy={35} r={1} fill="#fff" />
      </Svg>
    </Animated.View>
  );
});
VortexEyePet.displayName = 'VortexEyePet';

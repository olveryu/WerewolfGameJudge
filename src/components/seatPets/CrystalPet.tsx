/**
 * CrystalPet — 水晶球
 *
 * tarot 翻牌动画的伴生宠物。
 * 紫色渐变水晶球 + 底座 + 内部星光闪烁 + 星云脉动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

export const CrystalPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(3200);
  const t = useLoop(3000);

  // Inner nebula pulse
  const nebula1 = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.1 + Math.sin(t.value * Math.PI * 2) * 0.1 } as Record<string, number>;
  });
  const nebula2 = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.08 + Math.sin(t.value * Math.PI * 2 + 2) * 0.08 } as Record<string, number>;
  });

  // Star twinkles
  const star1 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(t.value * Math.PI * 4) * 0.5;
    return { r: 1 * s + 0.5, opacity: s } as Record<string, number>;
  });
  const star2 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(t.value * Math.PI * 4 + 1.4) * 0.5;
    return { r: 0.8 * s + 0.3, opacity: s } as Record<string, number>;
  });
  const star3 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(t.value * Math.PI * 4 + 2.8) * 0.5;
    return { r: 0.6 * s + 0.2, opacity: s } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Defs>
          <RadialGradient id="crystalGrad" cx="40%" cy="35%">
            <Stop offset="0%" stopColor="#c8b6ff" />
            <Stop offset="50%" stopColor="#7b68ee" />
            <Stop offset="100%" stopColor="#3d2b6e" />
          </RadialGradient>
        </Defs>
        {/* Base */}
        <Ellipse cx={36} cy={56} rx={14} ry={4} fill="#4a3d6e" />
        <Rect x={28} y={52} width={16} height={6} rx={2} fill="#5a4d7e" />
        {/* Ball */}
        <Circle cx={36} cy={36} r={16} fill="url(#crystalGrad)" />
        {/* Inner nebula */}
        <AnimatedCircle
          animatedProps={nebula1}
          cx={32}
          cy={32}
          r={6}
          fill="rgba(200,180,255,0.2)"
        />
        <AnimatedCircle
          animatedProps={nebula2}
          cx={40}
          cy={38}
          r={4}
          fill="rgba(255,200,255,0.15)"
        />
        {/* Stars inside */}
        <AnimatedCircle animatedProps={star1} cx={30} cy={30} fill="#fff" />
        <AnimatedCircle animatedProps={star2} cx={42} cy={34} fill="#fff" />
        <AnimatedCircle animatedProps={star3} cx={35} cy={40} fill="#fff" />
        {/* Highlight */}
        <Ellipse
          cx={30}
          cy={28}
          rx={5}
          ry={3}
          fill="rgba(255,255,255,0.25)"
          rotation={-30}
          origin="30, 28"
        />
      </Svg>
    </Animated.View>
  );
});
CrystalPet.displayName = 'CrystalPet';

/**
 * DicePet — 骰灵
 *
 * roulette 翻牌动画的伴生宠物。
 * 白紫色圆角骰子 + 可爱大眼 + 金色星光闪烁，缓慢浮动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

export const DicePet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2500);
  const t = useLoop(3000);

  // Eye blink pulse
  const leftEye = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.6 + Math.sin(t.value * Math.PI * 2) * 0.4 } as Record<string, number>;
  });

  // Sparkle twinkle
  const sparkle = useAnimatedProps(() => {
    'worklet';
    const s = 0.8 + Math.sin(t.value * Math.PI * 4) * 0.5;
    return { r: 1.5 * s, opacity: 0.5 + Math.sin(t.value * Math.PI * 4) * 0.5 } as Record<
      string,
      number
    >;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Dice body */}
        <Rect
          x={18}
          y={18}
          width={36}
          height={36}
          rx={6}
          fill="#e8e0f0"
          stroke="#9b8ec4"
          strokeWidth={1.5}
        />
        {/* Face dots */}
        <Circle cx={28} cy={28} r={3} fill="#4a3d6e" />
        <Circle cx={44} cy={28} r={3} fill="#4a3d6e" />
        <Circle cx={36} cy={36} r={3} fill="#4a3d6e" />
        <Circle cx={28} cy={44} r={3} fill="#4a3d6e" />
        <Circle cx={44} cy={44} r={3} fill="#4a3d6e" />
        {/* Cute eyes on top face */}
        <AnimatedCircle animatedProps={leftEye} cx={31} cy={23} r={2.5} fill="#2d1b4e" />
        <Ellipse cx={41} cy={23} rx={2} ry={2.5} fill="#2d1b4e" />
        <Path
          d="M33 26 Q36 28.5 39 26"
          stroke="#2d1b4e"
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
        />
        {/* Sparkle */}
        <AnimatedCircle animatedProps={sparkle} cx={52} cy={16} fill="#ffd700" />
      </Svg>
    </Animated.View>
  );
});
DicePet.displayName = 'DicePet';

/**
 * CardSpritePet — 牌灵
 *
 * cardPick 翻牌动画的伴生宠物。
 * 绿色小精灵坐在扑克牌上，翅膀轻摆 + 星光闪烁。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle, AnimatedEllipse } from './svgAnimatedPrimitives';

export const CardSpritePet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2700);
  const t = useLoop(1500);

  // Wing wobble
  const leftWing = useAnimatedProps(() => {
    'worklet';
    const rot = Math.sin(t.value * Math.PI * 2) * 8;
    return { rotation: rot } as Record<string, number>;
  });
  const rightWing = useAnimatedProps(() => {
    'worklet';
    const rot = Math.sin(t.value * Math.PI * 2 + 0.6) * 8;
    return { rotation: rot } as Record<string, number>;
  });

  // Sparkle twinkle
  const sparkle1 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(t.value * Math.PI * 4) * 0.5;
    return { r: 1.2 * s + 0.3, opacity: s } as Record<string, number>;
  });
  const sparkle2 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(t.value * Math.PI * 4 + 1) * 0.5;
    return { r: 1.0 * s + 0.2, opacity: s } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Card base */}
        <Rect
          x={22}
          y={28}
          width={28}
          height={38}
          rx={4}
          fill="#f0e6d3"
          stroke="#c4a882"
          strokeWidth={1}
        />
        <SvgText x={36} y={52} textAnchor="middle" fontSize={16} fill="#8b0000">
          ♠
        </SvgText>
        {/* Sprite sitting on card */}
        <Circle cx={36} cy={22} r={10} fill="#a8e6cf" />
        {/* Eyes */}
        <Circle cx={33} cy={20} r={2} fill="#1a1a2e" />
        <Circle cx={39} cy={20} r={2} fill="#1a1a2e" />
        <Circle cx={33.5} cy={19.5} r={0.6} fill="#fff" />
        <Circle cx={39.5} cy={19.5} r={0.6} fill="#fff" />
        {/* Smile */}
        <Path
          d="M33 24 Q36 26.5 39 24"
          stroke="#1a1a2e"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
        {/* Wings */}
        <AnimatedEllipse
          animatedProps={leftWing}
          cx={25}
          cy={22}
          rx={4}
          ry={6}
          fill="rgba(168,230,207,0.6)"
          origin="25, 22"
        />
        <AnimatedEllipse
          animatedProps={rightWing}
          cx={47}
          cy={22}
          rx={4}
          ry={6}
          fill="rgba(168,230,207,0.6)"
          origin="47, 22"
        />
        {/* Sparkles */}
        <AnimatedCircle animatedProps={sparkle1} cx={50} cy={14} fill="#ffd700" />
        <AnimatedCircle animatedProps={sparkle2} cx={22} cy={16} fill="#ffd700" />
      </Svg>
    </Animated.View>
  );
});
CardSpritePet.displayName = 'CardSpritePet';

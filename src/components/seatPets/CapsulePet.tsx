/**
 * CapsulePet — 蛋仔
 *
 * gachaMachine 翻牌动画的伴生宠物。
 * 扭蛋球造型，上下半壳 + 眼睛从接缝窥视 + 脸红 + 小脚，壳盖一开一合。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedG } from './svgAnimatedPrimitives';

export const CapsulePet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2600);
  const t = useLoop(2000);

  // Lid bounce — oscillating rotation around seam
  const lidProps = useAnimatedProps(() => {
    'worklet';
    const rot = Math.sin(t.value * Math.PI * 2) * -8;
    return { rotation: rot } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Bottom half */}
        <Path d="M20 38 Q20 56 36 56 Q52 56 52 38 Z" fill="#ff6b81" />
        {/* Top half (lid) — animated bounce */}
        <AnimatedG animatedProps={lidProps} origin="36, 38">
          <Path d="M20 38 Q20 20 36 18 Q52 20 52 38 Z" fill="#ff4757" opacity={0.9} />
        </AnimatedG>
        {/* Seam line */}
        <Line x1={20} y1={38} x2={52} y2={38} stroke="#c0392b" strokeWidth={1.5} />
        {/* Eyes peeking from seam */}
        <Circle cx={30} cy={36} r={4} fill="#fff" />
        <Circle cx={42} cy={36} r={4} fill="#fff" />
        <Circle cx={31} cy={36} r={2.5} fill="#1a1a2e" />
        <Circle cx={43} cy={36} r={2.5} fill="#1a1a2e" />
        <Circle cx={31.5} cy={35.5} r={0.8} fill="#fff" />
        <Circle cx={43.5} cy={35.5} r={0.8} fill="#fff" />
        {/* Blush */}
        <Ellipse cx={25} cy={40} rx={3} ry={2} fill="rgba(255,150,150,0.5)" />
        <Ellipse cx={47} cy={40} rx={3} ry={2} fill="rgba(255,150,150,0.5)" />
        {/* Small feet */}
        <Ellipse cx={29} cy={56} rx={4} ry={2} fill="#e84a5f" />
        <Ellipse cx={43} cy={56} rx={4} ry={2} fill="#e84a5f" />
      </Svg>
    </Animated.View>
  );
});
CapsulePet.displayName = 'CapsulePet';

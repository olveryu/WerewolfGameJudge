/**
 * ChainDragonPet — 锁龙
 *
 * chainShatter 翻牌动画的伴生宠物。
 * 绿色小龙 + 双角 + 红瞳 + 断链晃动 + 小翅膀，浮动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedEllipse } from './svgAnimatedPrimitives';

export const ChainDragonPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2800);
  const t = useLoop(500);
  const tSlow = useLoop(2000);

  // Chain shake — fast oscillation
  const chainLeft = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2) * 1;
    return { cx: 22 + dx } as Record<string, number>;
  });
  const chainRight = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2 + 0.4) * 1;
    return { cx: 50 + dx } as Record<string, number>;
  });

  // Wing wobble
  const leftWing = useAnimatedProps(() => {
    'worklet';
    return { rotation: Math.sin(tSlow.value * Math.PI * 2) * 8 } as Record<string, number>;
  });
  const rightWing = useAnimatedProps(() => {
    'worklet';
    return { rotation: Math.sin(tSlow.value * Math.PI * 2 + 0.6) * 8 } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Body */}
        <Ellipse cx={36} cy={44} rx={14} ry={12} fill="#5b8c5a" />
        {/* Tail */}
        <Path
          d="M50 44 Q58 36 56 44 Q54 50 52 46"
          stroke="#5b8c5a"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        {/* Head */}
        <Circle cx={36} cy={28} r={12} fill="#6aa66a" />
        {/* Horns */}
        <Path d="M28 20 L24 12 L30 18" fill="#8bc48a" />
        <Path d="M44 20 L48 12 L42 18" fill="#8bc48a" />
        {/* Eyes */}
        <Circle cx={32} cy={26} r={3} fill="#fff" />
        <Circle cx={40} cy={26} r={3} fill="#fff" />
        <Circle cx={33} cy={26} r={1.8} fill="#c0392b" />
        <Circle cx={41} cy={26} r={1.8} fill="#c0392b" />
        {/* Nose smoke */}
        <Circle cx={34} cy={32} r={0.8} fill="#4a5568" />
        <Circle cx={38} cy={32} r={0.8} fill="#4a5568" />
        {/* Chain pieces — left */}
        <AnimatedEllipse
          animatedProps={chainLeft}
          cy={38}
          rx={3}
          ry={4}
          fill="none"
          stroke="#a8a8a8"
          strokeWidth={1.5}
        />
        <Ellipse
          cx={18}
          cy={42}
          rx={3}
          ry={4}
          fill="none"
          stroke="#a8a8a8"
          strokeWidth={1.5}
          rotation={20}
          origin="18, 42"
        />
        {/* Chain pieces — right */}
        <AnimatedEllipse
          animatedProps={chainRight}
          cy={36}
          rx={3}
          ry={4}
          fill="none"
          stroke="#a8a8a8"
          strokeWidth={1.5}
        />
        <Ellipse
          cx={54}
          cy={40}
          rx={3}
          ry={4}
          fill="none"
          stroke="#a8a8a8"
          strokeWidth={1.5}
          rotation={-20}
          origin="54, 40"
        />
        {/* Small wings */}
        <AnimatedEllipse
          animatedProps={leftWing}
          cx={24}
          cy={30}
          rx={4}
          ry={3}
          fill="rgba(107,166,106,0.5)"
          origin="24, 30"
        />
        <AnimatedEllipse
          animatedProps={rightWing}
          cx={48}
          cy={30}
          rx={4}
          ry={3}
          fill="rgba(107,166,106,0.5)"
          origin="48, 30"
        />
      </Svg>
    </Animated.View>
  );
});
ChainDragonPet.displayName = 'ChainDragonPet';

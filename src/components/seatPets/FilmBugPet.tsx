/**
 * FilmBugPet — 胶片虫
 *
 * filmRewind 翻牌动画的伴生宠物。
 * 胶片卷造型虫子 + 齿孔 + 金眼 + 触角 + 4 条腿交替抽动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedLine } from './svgAnimatedPrimitives';

export const FilmBugPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(3000);
  const t = useLoop(1200);

  // Left legs pull
  const legL1 = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2) * -2;
    return { x2: 24 + dx, y2: 58 + dx } as Record<string, number>;
  });
  const legL2 = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2) * -2;
    return { x2: 30 + dx, y2: 58 + dx } as Record<string, number>;
  });
  // Right legs pull (offset phase)
  const legR1 = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2 + Math.PI) * 2;
    return { x2: 42 + dx, y2: 58 + dx } as Record<string, number>;
  });
  const legR2 = useAnimatedProps(() => {
    'worklet';
    const dx = Math.sin(t.value * Math.PI * 2 + Math.PI) * 2;
    return { x2: 48 + dx, y2: 58 + dx } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Film strip body */}
        <Rect x={20} y={26} width={32} height={24} rx={4} fill="#3d3d3d" />
        {/* Sprocket holes — top */}
        <Rect x={22} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={28} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={34} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={40} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={46} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        {/* Sprocket holes — bottom */}
        <Rect x={22} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={28} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={34} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={40} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        <Rect x={46} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
        {/* Frame window */}
        <Rect x={24} y={32} width={24} height={12} rx={1} fill="#5a4a3a" />
        {/* Face on frame */}
        <Circle cx={32} cy={37} r={2} fill="#ffd700" />
        <Circle cx={40} cy={37} r={2} fill="#ffd700" />
        <Circle cx={32} cy={37} r={1} fill="#1a1a2e" />
        <Circle cx={40} cy={37} r={1} fill="#1a1a2e" />
        <Path d="M34 40 Q36 41.5 38 40" stroke="#ffd700" strokeWidth={0.8} fill="none" />
        {/* Antennae */}
        <Line x1={30} y1={26} x2={28} y2={18} stroke="#5a5a5a" strokeWidth={1} />
        <Circle cx={28} cy={17} r={2} fill="#ffd700" />
        <Line x1={42} y1={26} x2={44} y2={18} stroke="#5a5a5a" strokeWidth={1} />
        <Circle cx={44} cy={17} r={2} fill="#ffd700" />
        {/* Legs — left pair */}
        <AnimatedLine
          animatedProps={legL1}
          x1={26}
          y1={50}
          stroke="#3d3d3d"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <AnimatedLine
          animatedProps={legL2}
          x1={32}
          y1={50}
          stroke="#3d3d3d"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Legs — right pair */}
        <AnimatedLine
          animatedProps={legR1}
          x1={40}
          y1={50}
          stroke="#3d3d3d"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <AnimatedLine
          animatedProps={legR2}
          x1={46}
          y1={50}
          stroke="#3d3d3d"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
});
FilmBugPet.displayName = 'FilmBugPet';

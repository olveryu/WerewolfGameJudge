/**
 * LuckyStarPet — 幸运星
 *
 * fortuneWheel 翻牌动画的伴生宠物。
 * 金色五角星 + 可爱脸 + 肚皮转盘缓转 + 星光闪烁，浮动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle, AnimatedG } from './svgAnimatedPrimitives';

/** Generate 5-point star polygon points */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
    pts.push(`${cx + Math.cos(outerAngle) * outer},${cy + Math.sin(outerAngle) * outer}`);
    pts.push(`${cx + Math.cos(innerAngle) * inner},${cy + Math.sin(innerAngle) * inner}`);
  }
  return pts.join(' ');
}

export const LuckyStarPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2500);
  const tWheel = useLoop(6000);
  const tSparkle = useLoop(1500);

  // Belly wheel spin
  const wheelProps = useAnimatedProps(() => {
    'worklet';
    return { rotation: tWheel.value * 360 } as Record<string, number>;
  });

  // Sparkle twinkle
  const sparkle1 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(tSparkle.value * Math.PI * 4) * 0.5;
    return { r: 1.5 * s + 0.3, opacity: s } as Record<string, number>;
  });
  const sparkle2 = useAnimatedProps(() => {
    'worklet';
    const s = 0.5 + Math.sin(tSparkle.value * Math.PI * 4 + 1) * 0.5;
    return { r: 1.0 * s + 0.2, opacity: s } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Star body */}
        <Polygon
          points={starPoints(36, 36, 24, 10)}
          fill="#ffd700"
          stroke="#daa520"
          strokeWidth={1}
        />
        {/* Face */}
        <Circle cx={32} cy={30} r={2} fill="#8b6508" />
        <Circle cx={40} cy={30} r={2} fill="#8b6508" />
        <Path
          d="M33 34 Q36 36.5 39 34"
          stroke="#8b6508"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
        {/* Mini wheel on belly */}
        <AnimatedG animatedProps={wheelProps} origin="36, 38">
          <Circle cx={36} cy={38} r={5} fill="none" stroke="#daa520" strokeWidth={1} />
          <Line x1={36} y1={33} x2={36} y2={43} stroke="#daa520" strokeWidth={0.5} />
          <Line x1={31} y1={38} x2={41} y2={38} stroke="#daa520" strokeWidth={0.5} />
          <Line x1={32.5} y1={34.5} x2={39.5} y2={41.5} stroke="#daa520" strokeWidth={0.5} />
          <Line x1={39.5} y1={34.5} x2={32.5} y2={41.5} stroke="#daa520" strokeWidth={0.5} />
        </AnimatedG>
        {/* Sparkles */}
        <AnimatedCircle animatedProps={sparkle1} cx={56} cy={16} fill="#fff" />
        <AnimatedCircle animatedProps={sparkle2} cx={18} cy={18} fill="#fff" />
      </Svg>
    </Animated.View>
  );
});
LuckyStarPet.displayName = 'LuckyStarPet';

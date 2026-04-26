/**
 * MeteorBuddyPet — 陨石仔
 *
 * meteorStrike 翻牌动画的伴生宠物。
 * 棕色陨石 + 渐变质感 + 火焰尾巴闪烁 + 可爱脸 + 弹坑 + 光环脉动。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle, AnimatedEllipse } from './svgAnimatedPrimitives';

export const MeteorBuddyPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(2000);
  const tFlame = useLoop(800);
  const tPulse = useLoop(2000);

  // Flame flicker — opacity + scaleY effect via ry
  const flame1 = useAnimatedProps(() => {
    'worklet';
    const f = 0.7 + Math.sin(tFlame.value * Math.PI * 2) * 0.3;
    return { opacity: f, ry: 10 + Math.sin(tFlame.value * Math.PI * 2) * 1.5 } as Record<
      string,
      number
    >;
  });
  const flame2 = useAnimatedProps(() => {
    'worklet';
    const f = 0.5 + Math.sin(tFlame.value * Math.PI * 2 + 1) * 0.3;
    return { opacity: f, ry: 8 + Math.sin(tFlame.value * Math.PI * 2 + 1) * 1.2 } as Record<
      string,
      number
    >;
  });
  const flame3 = useAnimatedProps(() => {
    'worklet';
    const f = 0.4 + Math.sin(tFlame.value * Math.PI * 2 + 2) * 0.3;
    return { opacity: f, ry: 7 + Math.sin(tFlame.value * Math.PI * 2 + 2) * 1 } as Record<
      string,
      number
    >;
  });

  // Glow ring pulse
  const glowRing = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.2 + Math.sin(tPulse.value * Math.PI * 2) * 0.15 } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Defs>
          <RadialGradient id="meteorGrad" cx="35%" cy="30%">
            <Stop offset="0%" stopColor="#c4a882" />
            <Stop offset="100%" stopColor="#6b5340" />
          </RadialGradient>
        </Defs>
        {/* Flame tail */}
        <AnimatedEllipse animatedProps={flame1} cx={36} cy={58} rx={8} fill="#ff6b35" />
        <AnimatedEllipse animatedProps={flame2} cx={33} cy={60} rx={5} fill="#ff9a3c" />
        <AnimatedEllipse animatedProps={flame3} cx={39} cy={59} rx={4} fill="#ffcc02" />
        {/* Meteor body */}
        <Circle cx={36} cy={34} r={16} fill="url(#meteorGrad)" />
        {/* Craters */}
        <Circle cx={30} cy={38} r={3} fill="rgba(0,0,0,0.15)" />
        <Circle cx={42} cy={32} r={2} fill="rgba(0,0,0,0.1)" />
        <Circle cx={34} cy={44} r={2} fill="rgba(0,0,0,0.1)" />
        {/* Face */}
        <Circle cx={31} cy={31} r={2.5} fill="#fff" />
        <Circle cx={41} cy={31} r={2.5} fill="#fff" />
        <Circle cx={31.5} cy={31} r={1.5} fill="#1a1a2e" />
        <Circle cx={41.5} cy={31} r={1.5} fill="#1a1a2e" />
        <Path
          d="M34 36 Q36 38 38 36"
          stroke="#4a3628"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
        {/* Glow ring */}
        <AnimatedCircle
          animatedProps={glowRing}
          cx={36}
          cy={34}
          r={18}
          fill="none"
          stroke="#ff9a3c"
          strokeWidth={0.5}
        />
      </Svg>
    </Animated.View>
  );
});
MeteorBuddyPet.displayName = 'MeteorBuddyPet';

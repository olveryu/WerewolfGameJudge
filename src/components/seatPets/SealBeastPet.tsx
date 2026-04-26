/**
 * SealBeastPet — 印兽
 *
 * sealBreak 翻牌动画的伴生宠物。
 * 灰蓝石兽 + 独角 + 金色眼睛脉动 + 脚下符纸 + "封"字闪烁。
 */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { type PetProps, useFloat, useLoop } from './PetProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

export const SealBeastPet = memo<PetProps>(({ size }) => {
  const { floatStyle } = useFloat(3000);
  const t = useLoop(2500);

  // Eye glow pulse
  const leftEye = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.6 + Math.sin(t.value * Math.PI * 2) * 0.4 } as Record<string, number>;
  });
  const rightEye = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.6 + Math.sin(t.value * Math.PI * 2 + 1) * 0.4 } as Record<string, number>;
  });

  // Rune glow
  const runeGlow = useAnimatedProps(() => {
    'worklet';
    return { opacity: 0.3 + Math.sin(t.value * Math.PI * 2 + 1) * 0.3 } as Record<string, number>;
  });

  return (
    <Animated.View style={[{ width: size, height: size }, floatStyle]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        {/* Seal/talisman paper */}
        <Rect
          x={22}
          y={42}
          width={28}
          height={20}
          rx={2}
          fill="#f5e6c8"
          stroke="#c4956a"
          strokeWidth={1}
        />
        {/* Rune symbol */}
        <SvgText x={36} y={55} textAnchor="middle" fontSize={10} fill="#8b0000" fontWeight="bold">
          封
        </SvgText>
        <AnimatedCircle animatedProps={runeGlow} cx={36} cy={48} r={14} fill="rgba(200,0,0,0.1)" />
        {/* Beast body */}
        <Ellipse cx={36} cy={36} rx={12} ry={10} fill="#6c7b95" />
        {/* Head */}
        <Circle cx={36} cy={26} r={10} fill="#7b8da8" />
        {/* Horn */}
        <Polygon points="36,14 33,22 39,22" fill="#a8c4d8" />
        {/* Eyes */}
        <AnimatedCircle animatedProps={leftEye} cx={32} cy={24} r={2.5} fill="#ffd700" />
        <AnimatedCircle animatedProps={rightEye} cx={40} cy={24} r={2.5} fill="#ffd700" />
        <Circle cx={32} cy={24} r={1.2} fill="#1a1a2e" />
        <Circle cx={40} cy={24} r={1.2} fill="#1a1a2e" />
        {/* Mouth */}
        <Path d="M33 29 Q36 31 39 29" stroke="#4a5568" strokeWidth={0.8} fill="none" />
      </Svg>
    </Animated.View>
  );
});
SealBeastPet.displayName = 'SealBeastPet';

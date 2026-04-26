import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WraithBoneFrame — 幽骨
 *
 * 苍白骨骼框 · 四角骷髅面角饰 · 肋骨/骨节突起 · 灵魂绿光点缀。
 */
export const WraithBoneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wbM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D5D5D0" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#A0A098" stopOpacity={1} />
          <Stop offset="1" stopColor="#D5D5D0" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#1A1A18"
        strokeWidth={6}
        opacity={0.15}
      />
      {/* Main bone frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={5}
      />
      {/* Inner line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#E0E0D8"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Skull face — top-left corner */}
      <Circle cx={0} cy={0} r={5} fill="#C8C8C0" stroke="#A0A098" strokeWidth={0.8} opacity={0.8} />
      <Circle cx={-1.5} cy={-1} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Circle cx={1.5} cy={-1} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Path
        d="M-1,1.5 L0,2.5 L1,1.5"
        fill="none"
        stroke="#2C2C28"
        strokeWidth={0.5}
        opacity={0.6}
      />
      {/* Skull — top-right */}
      <Circle
        cx={100}
        cy={0}
        r={5}
        fill="#C8C8C0"
        stroke="#A0A098"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Circle cx={98.5} cy={-1} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Circle cx={101.5} cy={-1} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Path
        d="M99,1.5 L100,2.5 L101,1.5"
        fill="none"
        stroke="#2C2C28"
        strokeWidth={0.5}
        opacity={0.6}
      />
      {/* Skull — bottom-left */}
      <Circle
        cx={0}
        cy={100}
        r={5}
        fill="#C8C8C0"
        stroke="#A0A098"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Circle cx={-1.5} cy={99} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Circle cx={1.5} cy={99} r={1.2} fill="#2C2C28" opacity={0.7} />
      {/* Skull — bottom-right */}
      <Circle
        cx={100}
        cy={100}
        r={5}
        fill="#C8C8C0"
        stroke="#A0A098"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Circle cx={98.5} cy={99} r={1.2} fill="#2C2C28" opacity={0.7} />
      <Circle cx={101.5} cy={99} r={1.2} fill="#2C2C28" opacity={0.7} />
      {/* Rib bone protrusions — top */}
      <Path
        d="M20,-1 Q22,-4 24,-1 Q22,-2 20,-1 Z"
        fill="#D5D5D0"
        stroke="#B8B8B0"
        strokeWidth={0.4}
        opacity={0.75}
      />
      <Path d="M38,-1 Q40,-3 42,-1 Q40,-2 38,-1 Z" fill="#C8C8C0" opacity={0.7} />
      <Path
        d="M58,-1 Q60,-4 62,-1 Q60,-2 58,-1 Z"
        fill="#D5D5D0"
        stroke="#B8B8B0"
        strokeWidth={0.4}
        opacity={0.75}
      />
      <Path d="M78,-1 Q80,-3 82,-1 Q80,-2 78,-1 Z" fill="#C8C8C0" opacity={0.7} />
      {/* Rib — bottom */}
      <Path d="M25,101 Q27,104 29,101 Q27,102 25,101 Z" fill="#D5D5D0" opacity={0.75} />
      <Path d="M48,101 Q50,104 52,101 Q50,102 48,101 Z" fill="#D5D5D0" opacity={0.75} />
      <Path d="M72,101 Q74,103 76,101 Q74,102 72,101 Z" fill="#C8C8C0" opacity={0.7} />
      {/* Side bone bumps */}
      <Path
        d="M-1,30 Q-3,32 -1,34"
        fill="none"
        stroke="#C8C8C0"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M-1,60 Q-3,62 -1,64"
        fill="none"
        stroke="#C8C8C0"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M101,40 Q103,42 101,44"
        fill="none"
        stroke="#C8C8C0"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M101,70 Q103,72 101,74"
        fill="none"
        stroke="#C8C8C0"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Soul-fire green glow */}
      <Circle cx={50} cy={-4} r={1.5} fill="#58D68D" opacity={0.6} />
      <Circle cx={-4} cy={50} r={1.2} fill="#58D68D" opacity={0.5} />
      <Circle cx={104} cy={50} r={1.2} fill="#58D68D" opacity={0.5} />
      <Circle cx={50} cy={104} r={1.5} fill="#58D68D" opacity={0.6} />
    </Svg>
  );
});
WraithBoneFrame.displayName = 'WraithBoneFrame';

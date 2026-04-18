/**
 * SimpleDiamondFrame — 菱形
 *
 * 45° 旋转的菱形边框。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleDiamondFrame = memo<ColoredFrameProps>(({ size, colors }) => {
  const uid = useId();
  const gradId = `diamGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Diamond (rotated square) */}
      <Path
        d="M 50 2 L 98 50 L 50 98 L 2 50 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
SimpleDiamondFrame.displayName = 'SimpleDiamondFrame';

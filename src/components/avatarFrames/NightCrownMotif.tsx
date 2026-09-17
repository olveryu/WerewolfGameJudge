/** Shared silver crown and crimson crystal artwork; SVG children only, no animation ownership. */
import { G, Path } from 'react-native-svg';

import { MYTHIC_COLORS } from '@/config/mythicVisual';

/** Draws a crown in a 100 by 70 coordinate area. */
export function NightCrownMotif() {
  return (
    <G strokeLinejoin="round">
      <Path
        d="M12 57 L1 19 L29 36 L33 16 L50 1 L67 16 L71 36 L99 19 L88 57 L50 69 Z"
        fill={MYTHIC_COLORS.obsidian}
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={2}
      />
      <Path
        d="M12 57 L1 19 L24 45 L33 16 L50 1 L40 39 L50 52 L60 39 L50 1 L67 16 L76 45 L99 19 L88 57 L50 69 Z"
        fill={MYTHIC_COLORS.silver}
      />
      <Path
        d="M12 57 L50 61 L88 57 M33 16 L24 45 M67 16 L76 45"
        fill="none"
        stroke={MYTHIC_COLORS.pearl}
      />
      <Path
        d="M50 28 L58 43 L50 59 L42 43 Z"
        fill={MYTHIC_COLORS.enamel}
        stroke={MYTHIC_COLORS.highlight}
      />
      <Path d="M50 28 L58 43 L50 48 Z" fill={MYTHIC_COLORS.crystal} />
    </G>
  );
}

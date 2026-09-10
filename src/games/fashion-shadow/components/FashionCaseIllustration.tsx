/** Four lightweight animated case illustrations inspired by the Fashion Shadow art direction. */

import type { FashionRound } from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { borderRadius, fixed } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

const ART_WIDTH = 320;
const ART_HEIGHT = 128;
const ART_DRIFT_DURATION_MS = 4200;

interface FashionCaseIllustrationProps {
  readonly round: FashionRound;
}

function FabricMarketScene(): React.ReactNode {
  return (
    <>
      <Rect x="14" y="20" width="78" height="88" rx="8" fill={fashionShadowColors.surfaceRaised} />
      <Rect
        x="26"
        y="8"
        width="52"
        height="22"
        rx="4"
        fill={fashionShadowColors.neonPinkSoft}
        stroke={fashionShadowColors.neonPink}
      />
      <Line x1="34" y1="42" x2="34" y2="98" stroke={fashionShadowColors.neonCyan} strokeWidth="2" />
      <Line x1="52" y1="42" x2="52" y2="98" stroke={fashionShadowColors.neonPink} strokeWidth="2" />
      <Line x1="70" y1="42" x2="70" y2="98" stroke={fashionShadowColors.warning} strokeWidth="2" />
      <Rect
        x="114"
        y="30"
        width="182"
        height="68"
        rx="10"
        fill={fashionShadowColors.surface}
        stroke={fashionShadowColors.neonCyanSoft}
      />
      <Path
        d="M128 76 C160 38 192 110 222 62 C246 28 268 68 286 42"
        fill="none"
        stroke={fashionShadowColors.neonPink}
        strokeWidth="3"
      />
      <Path
        d="M128 88 C164 56 198 118 232 78 C252 54 270 88 286 66"
        fill="none"
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="2"
      />
      <Circle cx="138" cy="46" r="6" fill={fashionShadowColors.neonPink} />
    </>
  );
}

function FactoryScene(): React.ReactNode {
  return (
    <>
      <Rect
        x="18"
        y="54"
        width="118"
        height="56"
        rx="8"
        fill={fashionShadowColors.surfaceRaised}
        stroke={fashionShadowColors.neonCyanSoft}
      />
      <Rect
        x="32"
        y="28"
        width="22"
        height="82"
        rx="4"
        fill={fashionShadowColors.surface}
        stroke={fashionShadowColors.neonPink}
      />
      <Rect
        x="74"
        y="38"
        width="18"
        height="72"
        rx="4"
        fill={fashionShadowColors.surface}
        stroke={fashionShadowColors.neonCyan}
      />
      <Path
        d="M92 64 H170 V92 H232"
        fill="none"
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="5"
      />
      <Path
        d="M232 92 C240 80 250 78 258 92 C266 106 278 106 286 92"
        fill="none"
        stroke={fashionShadowColors.neonPink}
        strokeWidth="3"
      />
      <Circle
        cx="244"
        cy="38"
        r="16"
        fill={fashionShadowColors.neonCyanSoft}
        stroke={fashionShadowColors.neonCyan}
      />
      <Path
        d="M244 24 C252 36 258 44 244 52 C230 44 236 36 244 24 Z"
        fill={fashionShadowColors.neonCyan}
      />
    </>
  );
}

function ContainerScene(): React.ReactNode {
  return (
    <>
      <Line
        x1="20"
        y1="102"
        x2="302"
        y2="102"
        stroke={fashionShadowColors.neonCyanSoft}
        strokeWidth="2"
      />
      <Rect
        x="36"
        y="68"
        width="76"
        height="30"
        rx="4"
        fill={fashionShadowColors.neonPinkSoft}
        stroke={fashionShadowColors.neonPink}
      />
      <Rect
        x="116"
        y="68"
        width="76"
        height="30"
        rx="4"
        fill={fashionShadowColors.surfaceRaised}
        stroke={fashionShadowColors.neonCyan}
      />
      <Rect
        x="76"
        y="34"
        width="76"
        height="30"
        rx="4"
        fill={fashionShadowColors.surfaceRaised}
        stroke={fashionShadowColors.neonPinkSoft}
      />
      <Line
        x1="222"
        y1="18"
        x2="222"
        y2="94"
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="4"
      />
      <Line
        x1="222"
        y1="18"
        x2="292"
        y2="18"
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="4"
      />
      <Line
        x1="280"
        y1="18"
        x2="280"
        y2="58"
        stroke={fashionShadowColors.neonPink}
        strokeWidth="2"
      />
      <Path d="M270 58 H290 L280 72 Z" fill={fashionShadowColors.neonPink} />
      <Line x1="46" y1="76" x2="102" y2="76" stroke={fashionShadowColors.neonPinkSoft} />
      <Line x1="126" y1="76" x2="182" y2="76" stroke={fashionShadowColors.neonCyanSoft} />
    </>
  );
}

function FinanceScene(): React.ReactNode {
  return (
    <>
      <Rect
        x="28"
        y="32"
        width="52"
        height="78"
        rx="6"
        fill={fashionShadowColors.surfaceRaised}
        stroke={fashionShadowColors.neonCyanSoft}
      />
      <Rect
        x="88"
        y="18"
        width="58"
        height="92"
        rx="6"
        fill={fashionShadowColors.surface}
        stroke={fashionShadowColors.neonPinkSoft}
      />
      <Rect
        x="154"
        y="48"
        width="44"
        height="62"
        rx="6"
        fill={fashionShadowColors.surfaceRaised}
        stroke={fashionShadowColors.neonCyanSoft}
      />
      <G stroke={fashionShadowColors.neonCyanSoft}>
        <Line x1="40" y1="50" x2="68" y2="50" />
        <Line x1="40" y1="66" x2="68" y2="66" />
        <Line x1="100" y1="40" x2="134" y2="40" />
        <Line x1="100" y1="56" x2="134" y2="56" />
      </G>
      <Path
        d="M194 78 C224 22 254 30 286 58"
        fill="none"
        stroke={fashionShadowColors.neonPink}
        strokeWidth="4"
      />
      <Circle cx="204" cy="70" r="6" fill={fashionShadowColors.neonPink} />
      <Circle
        cx="286"
        cy="58"
        r="9"
        fill={fashionShadowColors.neonCyanSoft}
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="2"
      />
      <Path
        d="M270 82 L288 60 L296 88"
        fill="none"
        stroke={fashionShadowColors.neonCyan}
        strokeWidth="2"
      />
    </>
  );
}

function getScene(round: FashionRound): React.ReactNode {
  switch (round) {
    case 1:
      return <FabricMarketScene />;
    case 2:
      return <FactoryScene />;
    case 3:
      return <ContainerScene />;
    case 4:
      return <FinanceScene />;
  }
}

export const FashionCaseIllustration: React.FC<FashionCaseIllustrationProps> = ({ round }) => {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: ART_DRIFT_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: ART_DRIFT_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(drift);
  }, [drift]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.78 + drift.value * 0.22,
    transform: [{ translateX: (drift.value - 0.5) * 6 }],
  }));

  return (
    <View style={styles.frame} pointerEvents="none">
      <Animated.View style={[styles.art, animatedStyle]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
          {getScene(round)}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    aspectRatio: ART_WIDTH / ART_HEIGHT,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.backgroundDeep,
    overflow: 'hidden',
  },
  art: { flex: 1 },
});

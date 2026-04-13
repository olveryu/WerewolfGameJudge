/**
 * Animated SVG primitives for seat flairs.
 *
 * Wraps react-native-svg primitives with Reanimated `createAnimatedComponent`
 * so that `useAnimatedProps` can drive cx/cy/opacity/stroke etc. on the UI thread.
 */
import Animated from 'react-native-reanimated';
import { Circle, Line, Path } from 'react-native-svg';

export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedLine = Animated.createAnimatedComponent(Line);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

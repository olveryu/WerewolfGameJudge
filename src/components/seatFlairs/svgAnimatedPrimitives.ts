/**
 * Animated SVG primitives for seat flairs.
 *
 * Wraps react-native-svg primitives with Reanimated `createAnimatedComponent`
 * so that `useAnimatedProps` can drive cx/cy/opacity/stroke etc. on the UI thread.
 */
import Animated from 'react-native-reanimated';
import { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedLine = Animated.createAnimatedComponent(Line);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

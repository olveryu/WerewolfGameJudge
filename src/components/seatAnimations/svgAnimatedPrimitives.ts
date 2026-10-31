/**
 * Animated SVG primitives for one-shot seat animations.
 *
 * Wraps react-native-svg primitives with Reanimated `createAnimatedComponent` so that
 * `useAnimatedProps` can drive cx/cy/opacity/stroke etc. Only for finite, event-triggered
 * animations (sit-down arrivals, reveal effects). Persistent decorations (seat flairs, pets,
 * avatar frames) must use `@/components/loopMotion` instead — see docs/loop-motion-design.md.
 */
import Animated from 'react-native-reanimated';
import { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedLine = Animated.createAnimatedComponent(Line);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

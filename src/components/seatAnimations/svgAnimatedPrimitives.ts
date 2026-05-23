/**
 * Re-export animated SVG primitives from shared for seat entrance animations.
 * Avoids duplicate `createAnimatedComponent` calls.
 */
export {
  AnimatedCircle,
  AnimatedEllipse,
  AnimatedLine,
  AnimatedPath,
} from '../shared/svgAnimatedPrimitives';

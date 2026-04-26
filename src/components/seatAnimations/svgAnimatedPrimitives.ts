/**
 * Re-export animated SVG primitives from seatFlairs for seat entrance animations.
 * Avoids duplicate `createAnimatedComponent` calls.
 */
export {
  AnimatedCircle,
  AnimatedEllipse,
  AnimatedLine,
  AnimatedPath,
} from '../seatFlairs/svgAnimatedPrimitives';

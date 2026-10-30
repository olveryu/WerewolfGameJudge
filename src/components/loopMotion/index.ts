/**
 * loopMotion — compositor-only looping motion primitives built on Reanimated CSS animations.
 *
 * Replaces the `useLoopProgress` + `useAnimatedProps` pattern (JS-thread rAF + SVG attribute
 * writes on web) for persistent decorations such as seat flairs. See `loopKeyframes.ts`.
 */
export { type DotFrame, type DotSampler, LoopDot } from './LoopDot';
export { type LayerFrame, type LayerSampler, LoopLayer } from './LoopLayer';
export { type LineFrame, type LineSampler, LoopLine } from './LoopLine';
export { LoopPath, type PathFrame, type PathSampler } from './LoopPath';
export { LoopRing, type RingFrame, type RingSampler } from './LoopRing';

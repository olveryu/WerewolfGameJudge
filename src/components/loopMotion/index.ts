/**
 * loopMotion — compositor-only looping motion primitives built on Reanimated CSS animations.
 *
 * Replaces the former shared-value loop + `useAnimatedProps` pattern (JS-thread rAF + SVG attribute
 * writes on web) for persistent decorations such as seat flairs. See `loopKeyframes.ts`.
 */
export { LoopDashFlow } from './LoopDashFlow';
export { type DotFrame, type DotSampler, LoopDot } from './LoopDot';
export { type LayerFrame, type LayerSampler, LoopLayer } from './LoopLayer';
export { type LineFrame, type LineSampler, LoopLine } from './LoopLine';
export { LoopMorph, type MorphFrame, type MorphMode, type MorphSampler } from './LoopMorph';
export { LoopPath, type PathFrame, type PathSampler } from './LoopPath';
export { LoopRing, type RingFrame, type RingSampler } from './LoopRing';

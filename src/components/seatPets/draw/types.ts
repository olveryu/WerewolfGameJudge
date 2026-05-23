/**
 * Pet draw function type definitions.
 *
 * Each pet is described by a PetDrawConfig: float duration, timer durations,
 * and a draw function that receives the Canvas context, viewBox scale, and progress values.
 */

export interface PetDrawConfig {
  /** Float bob cycle duration (ms). Produces vertical oscillation. */
  floatDuration: number;
  /** Animation timer durations in ms (for pet-specific animations). */
  durations: number[];
  /** Draw one frame. progress[] matches durations[] order, each ∈ [0,1). */
  draw: (ctx: CanvasRenderingContext2D, s: number, progress: [number, ...number[]]) => void;
}

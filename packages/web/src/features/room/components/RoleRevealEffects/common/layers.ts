/**
 * Stacking for the reveal overlay. DOM pieces sit below or above the one shared canvas host; Pixi
 * layers order among themselves inside it.
 */
export const REVEAL_DOM_LAYER = {
  /** Card faces, backgrounds and other DOM the canvas art draws over. */
  belowCanvas: 1,
  canvas: 2,
  /** Hints, buttons and interactive DOM over the canvas art. */
  aboveCanvas: 3,
  title: 100,
} as const;

export const REVEAL_PIXI_LAYER = {
  effect: 10,
  burst: 20,
  alignment: 30,
} as const;

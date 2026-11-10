/**
 * Seat entrance animations (docs/web-client-rewrite.md §6, "PixiJS 时间线"): one-shot timelines
 * that reveal a seat's avatar. The React Native client wrapped the avatar in a Reanimated view
 * and drew SVG effects around it; here the avatar stays in the DOM and is moved through its
 * style, while the effects are redrawn on the scene stage every frame from pure functions of the
 * time since the entrance started (see `timeline.ts`).
 */
import type { GraphicsContext } from 'pixi.js';

/**
 * Where one avatar copy is drawn, as the RN transform list `[translate, rotate, scale]` about the
 * avatar's centre, plus a 3D turn about its vertical axis with an 800 px perspective.
 */
export interface AvatarPose {
  opacity: number;
  /** In px. */
  translateX: number;
  /** In px. */
  translateY: number;
  scale: number;
  rotateDeg: number;
  rotateYDeg: number;
  /** Fractions of the avatar box hidden from the top and from the right (a growing clip). */
  clipTop: number;
  clipRight: number;
}

const IDENTITY_POSE: AvatarPose = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotateDeg: 0,
  rotateYDeg: 0,
  clipTop: 0,
  clipRight: 0,
};

export function pose(fields: Partial<AvatarPose>): AvatarPose {
  return { ...IDENTITY_POSE, ...fields };
}

/**
 * Draws one frame of effects `elapsedMs` after the entrance started, in the entrance square's
 * pixel space (`size` = the seat tile's border box, the previous client's animation size).
 */
export type EntranceArt = (context: GraphicsContext, elapsedMs: number, size: number) => void;

/**
 * Art whose shapes overlap under one RN view opacity: drawn opaque, then composited as one
 * group at `groupOpacity`.
 */
export interface EntranceGroup {
  draw: EntranceArt;
  groupOpacity: (elapsedMs: number) => number;
}

export type EntranceLayer = EntranceArt | EntranceGroup;

export interface EntranceSpec {
  /** Catalog seat animation id. */
  id: string;
  /**
   * When the previous client's animation reported completion: the seat's flair and pet show
   * again and the replay countdown starts.
   */
  completeMs: number;
  /** When every track has finished; frames stop after it until the next play. */
  settleMs: number;
  /**
   * Avatar copies back to front at `elapsedMs`; the last one is the avatar itself, earlier ones
   * are ghost copies.
   */
  avatar: (elapsedMs: number, size: number) => readonly AvatarPose[];
  /** Effects behind the avatar: they show through it only as far as it is transparent. */
  beneath?: EntranceLayer;
  /** Effects over the avatar. */
  above?: EntranceLayer;
  /** The animation box clips everything to the square, or to the tile's rounded corners. */
  clip: 'square' | 'rounded';
}

/** Gap between a finished entrance and its replay, as in the previous room seat tile. */
export const ENTRANCE_REPLAY_DELAY_MS = 10_000;

/**
 * What of the DOM avatar is opaque, relative to the entrance square. A picture covers its
 * rounded box: effects behind the avatar are erased there as far as the avatar is visible (an
 * approximation: the DOM picture below the canvas then shows at its own opacity). The wolf-paw
 * fallback is a flat tinted mark (an alpha image fitted into the mark box): while effects play
 * behind it, the stage paints the mark itself over them and the DOM avatar stays hidden, which
 * composites exactly as the previous client did.
 */
export type AvatarCoverage =
  | { kind: 'box'; x: number; y: number; width: number; height: number; radius: number }
  | {
      kind: 'mark';
      url: string;
      tint: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };

/** A seat's entrance square and avatar, measured from the DOM. */
export interface EntranceGeometry {
  /** The tile's border box in the scene host's coordinates. */
  x: number;
  y: number;
  size: number;
  /** The tile's corner radius, for entrances that clip to it. */
  cornerRadius: number;
  /** Centre of the avatar element, relative to the square: poses transform about it. */
  pivotX: number;
  pivotY: number;
  coverage: AvatarCoverage;
}

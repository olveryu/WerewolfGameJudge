/**
 * Generated frames: 10 common shapes and 5 rare shapes, each in the 10 palette colours (150
 * catalog frames). One chunk, loaded the first time a seat shows any of them.
 */
import type { FrameId } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

import { type ColoredFrameArt, staticFrame } from '../frameArt';
import { chainFrameArt } from './chain';
import { filigreeFrameArt } from './filigree';
import { gemFrameArt } from './gem';
import { grooveFrameArt } from './groove';
import { inlayFrameArt } from './inlay';
import { FRAME_PALETTE } from './palette';
import { simpleBevelFrameArt } from './simpleBevel';
import { simpleCrossFrameArt } from './simpleCross';
import { simpleDashFrameArt } from './simpleDash';
import { simpleDiamondFrameArt } from './simpleDiamond';
import { simpleDoubleFrameArt } from './simpleDouble';
import { simpleNotchFrameArt } from './simpleNotch';
import { simpleOctagonFrameArt } from './simpleOctagon';
import { simpleRoundFrameArt } from './simpleRound';
import { simpleScallopFrameArt } from './simpleScallop';
import { simpleSquareFrameArt } from './simpleSquare';

/** Catalog id prefix → template; the id is the prefix plus the capitalised colour key. */
const FRAME_TEMPLATES: Readonly<Record<string, ColoredFrameArt>> = {
  round: simpleRoundFrameArt,
  square: simpleSquareFrameArt,
  octagon: simpleOctagonFrameArt,
  dash: simpleDashFrameArt,
  double: simpleDoubleFrameArt,
  diamond: simpleDiamondFrameArt,
  scallop: simpleScallopFrameArt,
  cross: simpleCrossFrameArt,
  notch: simpleNotchFrameArt,
  bevel: simpleBevelFrameArt,
  inlay: inlayFrameArt,
  gem: gemFrameArt,
  filigree: filigreeFrameArt,
  chain: chainFrameArt,
  groove: grooveFrameArt,
};

function buildGeneratedFrames(): ReadonlyMap<string, DecorationSpec> {
  const specs = new Map<string, DecorationSpec>();
  for (const [prefix, template] of Object.entries(FRAME_TEMPLATES)) {
    for (const [colorKey, colors] of Object.entries(FRAME_PALETTE)) {
      const id = `${prefix}${colorKey[0]!.toUpperCase()}${colorKey.slice(1)}`;
      specs.set(
        id,
        staticFrame(id, ({ rx }) => template({ rx, colors })),
      );
    }
  }
  return specs;
}

const GENERATED_FRAMES = buildGeneratedFrames();

/**
 * The generated frame for a catalog id.
 *
 * @throws when the factory does not produce `id`
 */
export function generatedFrame(id: FrameId): DecorationSpec {
  const spec = GENERATED_FRAMES.get(id);
  if (spec === undefined) {
    throw new Error(`Missing avatar frame spec for "${id}"`);
  }
  return spec;
}

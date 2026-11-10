/**
 * Static avatar frames: artwork stays SVG markup (ported from the previous client's
 * react-native-svg components), which the stage rasterises at the seat's device-pixel size (see
 * `SvgNode`); only the moving parts become sampled scene nodes.
 */
import { LEGENDARY_FRAME_IDS } from '@game-judge/game-engine/product/rewards';

import type { DecorationNode, DecorationSpec, SvgArt } from '@/scene/decoration';

import type { FrameColorSet } from './common/palette';
import { FRAME_VIEWBOX, frameRx } from './frameBox';
import { legendaryShimmerNodes } from './legendaryShimmer';

export interface FrameArtProps {
  /** The avatar's corner radius in viewBox units. */
  rx: number;
}

/** Markup inside the frame's root `<svg>` (viewBox `-8 -8 116 116`). */
export type FrameArt = (props: FrameArtProps) => string;

/** A frame template, coloured by the generated-frame factory. */
export type ColoredFrameArt = (props: FrameArtProps & { colors: FrameColorSet }) => string;

/** Frame artwork covering the whole frame box. */
export function frameSvg(art: FrameArt): SvgArt {
  return (size) => ({
    width: size,
    height: size,
    viewBox: FRAME_VIEWBOX,
    body: art({ rx: frameRx(size) }),
  });
}

/** A frame whose artwork is static; legendary frames add their perimeter shimmer. */
export function staticFrame(id: string, art: FrameArt): DecorationSpec {
  const nodes: DecorationNode[] = [{ kind: 'svg', art: frameSvg(art) }];
  if (LEGENDARY_FRAME_IDS.has(id)) nodes.push(...legendaryShimmerNodes);
  return { id, anchor: 'avatarFrame', nodes };
}

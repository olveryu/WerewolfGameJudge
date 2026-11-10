/**
 * Contract: every reward-catalog avatar frame loads a decoration spec under its own id, anchored
 * to the avatar frame box, whose SVG artwork parses with every gradient reference resolved and
 * whose moving parts sample finite geometry (the frames are ported by codegen and by hand).
 */
import { FRAME_IDS, LEGENDARY_FRAME_IDS } from '@game-judge/game-engine/product/rewards';

import { exerciseDecorationNode } from '@/scene/__tests__/exerciseDecoration';
import { loadFrameSpec } from '@/scene/frames/registry';

/** A 76.5 px seat tile's frame box (× 116 / 100). */
const FRAME_BOX_SIZE = 88.74;

describe('avatar frame registry', () => {
  it.each([...FRAME_IDS])('%s loads a spec that draws its art', async (id) => {
    const spec = await loadFrameSpec(id);
    expect(spec.id).toBe(id);
    expect(spec.anchor).toBe('avatarFrame');
    expect(spec.nodes[0]?.kind).toBe('svg');
    for (const node of spec.nodes) exerciseDecorationNode(id, node, FRAME_BOX_SIZE);
  });

  it('adds the perimeter shimmer to legendary frames only', async () => {
    for (const id of FRAME_IDS) {
      const spec = await loadFrameSpec(id);
      const hasShimmer = spec.nodes.some((node) => node.kind === 'line');
      // Mythic frames carry their own perimeter sweeps.
      if (spec.nodes.some((node) => node.kind === 'layer')) continue;
      expect(hasShimmer, id).toBe(LEGENDARY_FRAME_IDS.has(id));
    }
  });
});

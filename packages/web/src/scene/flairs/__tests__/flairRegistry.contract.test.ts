/**
 * Contract: every reward-catalog seat flair has a decoration spec, and every spec samples finite
 * geometry and draws its art (the flairs are hand-ported, so this catches broken samplers or
 * path data before they reach the stage).
 */
import { SEAT_FLAIR_IDS } from '@game-judge/game-engine/product/rewards';

import { exerciseDecorationNode } from '@/scene/__tests__/exerciseDecoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';

const TILE_SIZE = 84;

describe('seat flair registry', () => {
  it('has exactly one spec per catalog flair id, under its own id', () => {
    expect([...FLAIR_SPECS.keys()]).toEqual([...SEAT_FLAIR_IDS]);
    for (const [id, spec] of FLAIR_SPECS) expect(spec.id).toBe(id);
  });

  it.each([...FLAIR_SPECS.values()].map((spec) => [spec.id, spec] as const))(
    '%s samples finite geometry and draws its art',
    (id, spec) => {
      expect(spec.nodes.length).toBeGreaterThan(0);
      for (const node of spec.nodes) exerciseDecorationNode(id, node, TILE_SIZE);
    },
  );
});

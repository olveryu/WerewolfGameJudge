/**
 * Contract: every reward-catalog role reveal effect has its seat pet, loaded under the effect's
 * id and anchored to the pet box, whose SVG artwork parses and whose moving parts sample finite
 * geometry.
 */
import { ROLE_REVEAL_EFFECT_IDS } from '@game-judge/game-engine/product/rewards';

import { exerciseDecorationNode } from '@/scene/__tests__/exerciseDecoration';
import { loadPetSpec } from '@/scene/pets/registry';

/** A pet on a 390 px phone: round(80.5 px grid cell × 0.32). */
const PET_SIZE = 26;

describe('seat pet registry', () => {
  it.each([...ROLE_REVEAL_EFFECT_IDS])('%s loads a pet that draws its art', async (id) => {
    const spec = await loadPetSpec(id);
    expect(spec.id).toBe(id);
    expect(spec.anchor).toBe('pet');
    for (const node of spec.nodes) exerciseDecorationNode(id, node, PET_SIZE);
  });
});

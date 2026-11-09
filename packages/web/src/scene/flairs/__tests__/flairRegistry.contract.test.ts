/**
 * Contract: every reward-catalog seat flair has a decoration spec, and every spec samples finite
 * geometry and draws its art (the flairs are hand-ported, so this catches broken samplers or
 * path data before they reach the stage).
 */
import { SEAT_FLAIR_IDS } from '@game-judge/game-engine/product/rewards';
import { GraphicsContext } from 'pixi.js';

import type { DecorationNode } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import {
  dashFlowOffset,
  deriveLineLayout,
  derivePathLayout,
  deriveRingLayout,
  sampleLoop,
} from '@/scene/loopGeometry';

const TILE_SIZE = 84;

function expectFinite(id: string, geometry: object): void {
  for (const [key, value] of Object.entries(geometry)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${id}: ${key} is ${String(value)}`);
    }
  }
}

/** Samples and draws a node the way the stage builds it. */
function exercise(id: string, node: DecorationNode): void {
  const context = new GraphicsContext();
  switch (node.kind) {
    case 'dot':
      sampleLoop(node.sample, TILE_SIZE, node.durationMs).forEach((frame) =>
        expectFinite(id, frame),
      );
      break;
    case 'line':
      deriveLineLayout(sampleLoop(node.sample, TILE_SIZE, node.durationMs));
      break;
    case 'ring':
      deriveRingLayout(sampleLoop(node.sample, TILE_SIZE, node.durationMs));
      break;
    case 'path': {
      const layout = derivePathLayout(sampleLoop(node.sample, TILE_SIZE, node.durationMs));
      node.art(context, layout.strokeMax, TILE_SIZE);
      break;
    }
    case 'morph':
      sampleLoop(node.sample, TILE_SIZE, node.durationMs).forEach((frame) =>
        expectFinite(id, frame),
      );
      for (let k = 0; k < node.variantCount; k += 1) node.art(new GraphicsContext(), k, TILE_SIZE);
      break;
    case 'dashFlow':
      node.art(context, dashFlowOffset(1, node.variantCount ?? 12, node.dashPeriod), TILE_SIZE);
      break;
    case 'static':
      node.art(context, TILE_SIZE);
      break;
    case 'layer':
      sampleLoop(node.sample, TILE_SIZE, node.durationMs).forEach((frame) =>
        expectFinite(id, frame),
      );
      node.art?.(context, TILE_SIZE);
      for (const child of node.children ?? []) exercise(id, child);
      break;
    case 'group':
      expectFinite(id, node.place(TILE_SIZE));
      for (const child of node.children) exercise(id, child);
      break;
  }
  context.destroy();
}

describe('seat flair registry', () => {
  it('has exactly one spec per catalog flair id, under its own id', () => {
    expect([...FLAIR_SPECS.keys()]).toEqual([...SEAT_FLAIR_IDS]);
    for (const [id, spec] of FLAIR_SPECS) expect(spec.id).toBe(id);
  });

  it.each([...FLAIR_SPECS.values()].map((spec) => [spec.id, spec] as const))(
    '%s samples finite geometry and draws its art',
    (id, spec) => {
      expect(spec.nodes.length).toBeGreaterThan(0);
      for (const node of spec.nodes) exercise(id, node);
    },
  );
});

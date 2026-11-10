/**
 * Test helper for decoration registries: samples and draws a decoration node the way the stage
 * builds it, so hand-ported samplers, path data and SVG markup fail in tests rather than on the
 * stage.
 */
import { GraphicsContext } from 'pixi.js';

import type { DecorationNode } from '@/scene/decoration';
import {
  dashFlowOffset,
  deriveLineLayout,
  derivePathLayout,
  deriveRingLayout,
  sampleLoop,
} from '@/scene/loopGeometry';
import { svgDocument } from '@/scene/svgTexture';

function expectFinite(id: string, geometry: object): void {
  for (const [key, value] of Object.entries(geometry)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${id}: ${key} is ${String(value)}`);
    }
  }
}

/** Parses the rasterised document and checks every `url(#id)` reference resolves in it. */
function expectWellFormedSvg(id: string, markup: string): void {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(`${id}: SVG does not parse: ${error.textContent}`);
  }
  for (const [, reference] of markup.matchAll(/url\(#([^)]+)\)/g)) {
    if (!document.getElementById(reference!)) {
      throw new Error(`${id}: url(#${reference}) has no target`);
    }
  }
}

/** Samples and draws `node` for a tile of `size` px; throws on non-finite or broken art. */
export function exerciseDecorationNode(id: string, node: DecorationNode, size: number): void {
  const context = new GraphicsContext();
  switch (node.kind) {
    case 'dot':
      sampleLoop(node.sample, size, node.durationMs).forEach((frame) => expectFinite(id, frame));
      break;
    case 'line':
      sampleLoop(node.sample, size, node.durationMs).forEach((frame) => expectFinite(id, frame));
      deriveLineLayout(sampleLoop(node.sample, size, node.durationMs));
      break;
    case 'ring':
      deriveRingLayout(sampleLoop(node.sample, size, node.durationMs));
      break;
    case 'path': {
      const layout = derivePathLayout(sampleLoop(node.sample, size, node.durationMs));
      node.art(context, layout.strokeMax, size);
      break;
    }
    case 'morph':
      sampleLoop(node.sample, size, node.durationMs).forEach((frame) => expectFinite(id, frame));
      for (let k = 0; k < node.variantCount; k += 1) node.art(new GraphicsContext(), k, size);
      break;
    case 'dashFlow':
      node.art(context, dashFlowOffset(1, node.variantCount ?? 12, node.dashPeriod), size);
      break;
    case 'static':
      node.art(context, size);
      break;
    case 'svg': {
      const artwork = node.art(size);
      expectFinite(id, { width: artwork.width, height: artwork.height, ...artwork.viewBox });
      expectWellFormedSvg(id, svgDocument(artwork, 2));
      break;
    }
    case 'layer':
      sampleLoop(node.sample, size, node.durationMs).forEach((frame) => expectFinite(id, frame));
      node.art?.(context, size);
      for (const child of node.children ?? []) exerciseDecorationNode(id, child, size);
      break;
    case 'group':
      expectFinite(id, node.place(size));
      for (const child of node.children) exerciseDecorationNode(id, child, size);
      break;
  }
  context.destroy();
}

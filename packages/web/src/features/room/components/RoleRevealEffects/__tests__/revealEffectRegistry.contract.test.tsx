/**
 * Contract: every reward-catalog reveal effect loads a component under its own id, mounts on the
 * reveal clock without throwing, and leaves nothing running once unmounted (no frame listener,
 * no Pixi layer, no timer). Only the registry statically imports effect implementations.
 * Reveals draw only on the shared scene stage and its clock.
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROLE_REVEAL_EFFECT_IDS } from '@game-judge/game-engine/product/rewards';
import { act, render } from '@testing-library/react';
import { Container } from 'pixi.js';

import { loadRevealEffect } from '../registry';
import { RevealScene, RevealSceneContext } from '../runtime';
import type { RevealEffectProps } from '../types';

const role = { id: 'seer', name: '预言家', alignment: 'god' } as const;
const otherRoles = [
  role,
  { id: 'wolf', name: '狼人', alignment: 'wolf' },
  { id: 'villager', name: '村民', alignment: 'villager' },
  { id: 'witch', name: '女巫', alignment: 'god' },
] as const;
const FRAME_MS = 16;

/**
 * A 2D context whose methods return itself, whose properties accept writes, and whose text
 * measures are zero.
 */
const inertContext: unknown = new Proxy(() => {}, {
  get: (_target, property) =>
    property === 'measureText'
      ? () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })
      : () => inertContext,
  set: () => true,
});

function trackListeners(scene: RevealScene): () => number {
  let active = 0;
  const subscribe = scene.subscribe.bind(scene);
  scene.subscribe = (listener) => {
    active++;
    const stop = subscribe(listener);
    let stopped = false;
    return () => {
      if (!stopped) active--;
      stopped = true;
      stop();
    };
  };
  return () => active;
}

describe('reveal effect registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no 2D canvas or ResizeObserver: Pixi rasterises radial gradients and measures text
    // on a 2D canvas, and card anchors observe their size.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => inertContext) as HTMLCanvasElement['getContext'],
    );
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([...ROLE_REVEAL_EFFECT_IDS])('%s plays and stops on unmount', async (id) => {
    vi.useRealTimers();
    const { Effect } = await loadRevealEffect(id);
    vi.useFakeTimers();
    const scene = new RevealScene(new Container({ sortableChildren: true }));
    const activeListeners = trackListeners(scene);
    const props: RevealEffectProps = {
      role,
      onComplete: () => {},
      reducedMotion: false,
      testIDPrefix: 'reveal',
      allRoles: otherRoles,
      remainingCards: 4,
    };
    const view = render(
      <RevealSceneContext value={scene}>
        <Effect {...props} />
      </RevealSceneContext>,
    );
    let nowMs = scene.now();
    for (let frame = 0; frame < 120; frame++) {
      nowMs += FRAME_MS;
      act(() => {
        scene.frame(nowMs);
        vi.advanceTimersByTime(FRAME_MS);
      });
    }

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(activeListeners()).toBe(0);
    expect(scene.root.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('statically imports effects only through the registry', () => {
    const effectsDir = path.resolve(import.meta.dirname, '../effects');
    const staticImporters = productionSources(path.join(PACKAGE_ROOT, 'src'))
      .filter(([file]) => !file.startsWith(effectsDir))
      .filter(
        ([, source]) =>
          /^\s*(?:import|export)\b[^;]*from\s+['"][^'"]*RoleRevealEffects\/effects\//m.test(
            source,
          ) || /^\s*(?:import|export)\b[^;]*from\s+['"]\.\/effects\//m.test(source),
      )
      .map(([file]) => path.relative(PACKAGE_ROOT, file));
    expect(staticImporters).toEqual(['src/features/room/components/RoleRevealEffects/registry.ts']);
  });

  // One PixiJS Application (the shared scene stage) and one clock (its ticker driving
  // RevealScene.frame): a reveal never starts its own renderer, frame loop or CSS animation.
  it('draws only on the shared stage and the reveal clock', () => {
    const offenders = productionSources(path.resolve(import.meta.dirname, '..'))
      .filter(([, source]) =>
        /new Application\b|\bTicker\b|requestAnimationFrame|@keyframes/.test(source),
      )
      .map(([file]) => path.relative(PACKAGE_ROOT, file));
    expect(offenders).toEqual([]);
  });
});

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '../../../../../..');

/** `[path, source]` of every non-test TypeScript file under `directory`. */
function productionSources(directory: string): (readonly [string, string])[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : productionSources(entryPath);
    return /\.tsx?$/.test(entry.name)
      ? [[entryPath, fs.readFileSync(entryPath, 'utf-8')] as const]
      : [];
  });
}

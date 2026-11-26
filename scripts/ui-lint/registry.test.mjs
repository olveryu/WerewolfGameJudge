/**
 * The registry's exemptions are pinned exactly (plan v3 §3): widening the token sheet, an art
 * sheet or a DOM writer shows up as a change to this file, not only as a registry line. The
 * build facts the bundle graph relies on are checked against their sources.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './bundle.mjs';
import {
  ART_SHEETS,
  BUILD_ENTRIES,
  DOM_WRITERS,
  ELEMENTS,
  SAFE_PRODUCTS,
  TOKEN_SHEET,
  WEB_ROOT,
} from './registry.mjs';

const read = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

describe('UI gate registry', () => {
  it('pins the token sheet and the art sheets (D7)', () => {
    expect(TOKEN_SHEET).toEqual({
      file: 'packages/web/src/theme/tokens.css',
      selectors: ['.admin-console', ':root'],
    });
    expect(ART_SHEETS).toEqual({
      'packages/web/src/boot/bootSplash.css': 'boot',
      'packages/web/src/components/nameStyles/nameStyles.css': 'name-style',
      'packages/web/src/features/gacha/machine/CapsuleMachine.css': 'capsule-machine',
      'packages/web/src/routes/bench/SceneBench.css': 'bench',
      'packages/web/src/scene/scene.css': 'scene-canvas',
      'packages/web/src/theme/nightArt.css': 'night-art',
    });
  });

  it('pins the DOM writers and safe products (E5)', () => {
    expect(DOM_WRITERS).toMatchInlineSnapshot(`
      {
        "packages/web/src/boot/bootSplash.ts": [
          "CSSStyleProperties.transform",
          "DOMStringMap.__index",
          "Element.textContent",
          "HTMLElement.hidden",
          "setAttribute:aria-valuenow",
        ],
        "packages/web/src/boot/dismissBootSplash.ts": [
          "ChildNode.remove",
          "DOMTokenList.add",
        ],
        "packages/web/src/boot/runtimeEnvironment.ts": [
          "HTMLScriptElement.src",
          "ParentNode.append",
          "createElement:script",
        ],
        "packages/web/src/config/avatarShape.ts": [
          "setProperty:--avatar-corner-ratio",
        ],
        "packages/web/src/features/gacha/machine/CapsuleMachine.tsx": [
          "CSSStyleProperties.transform",
        ],
        "packages/web/src/features/room/components/GalleryAlbumStage.tsx": [
          "CSSStyleProperties.height",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/common/AtmosphericBackground.tsx": [
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/common/RevealCardFace.tsx": [
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/ChainShatter.tsx": [
          "setAttribute:cx",
          "setAttribute:cy",
          "setAttribute:opacity",
          "setAttribute:r",
          "setAttribute:transform",
          "setAttribute:x1",
          "setAttribute:x2",
          "setAttribute:y1",
          "setAttribute:y2",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/FateDecree.tsx": [
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/MythicCollectionReveal.tsx": [
          "CSSStyleProperties.opacity",
          "setAttribute:opacity",
          "setAttribute:transform",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/RoleHunt.tsx": [
          "setAttribute:cx",
          "setAttribute:cy",
          "setAttribute:opacity",
          "setAttribute:r",
          "setAttribute:transform",
          "setAttribute:x2",
          "setAttribute:y2",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/ScratchReveal.tsx": [
          "CSSStyleProperties.width",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/SealBreak.tsx": [
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
          "Element.textContent",
          "setAttribute:cx",
          "setAttribute:cy",
          "setAttribute:opacity",
          "setAttribute:stroke-dasharray",
          "setAttribute:transform",
          "setAttribute:visibility",
          "setAttribute:x",
          "setAttribute:y",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/effects/TarotDraw.tsx": [
          "setAttribute:cy",
          "setAttribute:opacity",
          "setAttribute:r",
          "setAttribute:transform",
        ],
        "packages/web/src/features/room/components/RoleRevealEffects/runtime.ts": [
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
        ],
        "packages/web/src/features/room/services/shareImage.ts": [
          "ChildNode.remove",
          "HTMLAnchorElement.download",
          "HTMLHyperlinkElementUtils.href",
          "Node.appendChild",
        ],
        "packages/web/src/games/decrypto/room/DecryptoTeamSetup.tsx": [
          "setAttribute:closedby",
        ],
        "packages/web/src/games/spotmatch/room/hooks/useSpotmatchCardFlight.ts": [
          "Animatable.animate",
          "CSSStyleProperties.width",
        ],
        "packages/web/src/main.tsx": [
          "Element.textContent",
        ],
        "packages/web/src/routes/admin/AdminShell.tsx": [
          "setProperty:--admin-workspace-header-height",
        ],
        "packages/web/src/routes/bench/SceneBench.tsx": [
          "DOMStringMap.__index",
        ],
        "packages/web/src/scene/SeatEntrance.tsx": [
          "CSSStyleProperties.clipPath",
          "CSSStyleProperties.opacity",
          "CSSStyleProperties.transform",
          "Node.cloneNode",
          "ParentNode.replaceChildren",
          "removeProperty:clip-path",
          "removeProperty:opacity",
          "removeProperty:transform",
        ],
        "packages/web/src/scene/stage.ts": [
          "ChildNode.remove",
          "DOMTokenList.add",
          "ParentNode.append",
          "setAttribute:aria-hidden",
        ],
        "packages/web/src/services/infra/audio/BgmPlayer.ts": [
          "removeAttribute:src",
        ],
        "packages/web/src/services/infra/audio/WebAudioStrategy.ts": [
          "removeAttribute:src",
        ],
        "packages/web/src/theme/colors.ts": [
          "setProperty:*",
        ],
      }
    `);
    expect([...SAFE_PRODUCTS].sort()).toEqual([
      'HTMLAnchorElement',
      'HTMLAudioElement',
      'HTMLCanvasElement',
      'HTMLImageElement',
    ]);
    for (const file of Object.keys(DOM_WRITERS))
      expect(fs.existsSync(path.join(REPO_ROOT, file)), file).toBe(true);
  });

  it('never registers an element that loads or holds a stylesheet or script (E11)', () => {
    for (const tag of ['style', 'link', 'script', 'base', 'object', 'embed', 'template'])
      expect(ELEMENTS.has(tag), tag).toBe(false);
  });

  it('lists the entries the boot splash plugin adds', () => {
    const source = read('packages/web/build-plugins/bootSplash.ts').match(
      /const BOOT_SPLASH_SOURCE = '([^']+)'/,
    )[1];
    expect(BUILD_ENTRIES).toEqual([`${WEB_ROOT}/${source}`]);
  });

  it('resolves the same aliases as Vite', () => {
    const vite = read('packages/web/vite.config.ts');
    const tsconfig = read('packages/web/tsconfig.json');
    expect(vite).toContain('{ find: /^@\\//, replacement: `${sourceDirectory}/` }');
    expect(vite).toContain(
      '{ find: /^@game-judge\\/game-engine\\//, replacement: `${engineSourceDirectory}/` }',
    );
    expect(vite.match(/\{ find: /g)).toHaveLength(2);
    expect(tsconfig).toContain('"@/*": ["./src/*"]');
    expect(tsconfig).toContain('"@game-judge/game-engine/*": ["../game-engine/src/*"]');
  });
});

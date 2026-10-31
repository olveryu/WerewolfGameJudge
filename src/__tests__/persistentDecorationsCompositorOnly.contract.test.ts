/**
 * Contract test: persistent seat decorations are compositor-only
 *
 * Seat flairs, seat pets and avatar frames render on every seat for the whole room session.
 * They must animate through `src/components/loopMotion` (Reanimated CSS animations → real
 * `@keyframes` on web) and never through JS-thread shared-value loops, which on web become a
 * `requestAnimationFrame` chain writing SVG attributes every frame.
 *
 * Also guards the one-shot `RoleRevealEffects`: any file that starts an infinite
 * `withRepeat(…, -1)` must `cancelAnimation` somewhere, otherwise the loop outlives the effect.
 *
 * See docs/loop-motion-design.md and agents/path-rules/screens.md.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..');

const PERSISTENT_DECORATION_DIRS = [
  'components/seatFlairs',
  'components/seatPets',
  'components/avatarFrames',
] as const;

const REVEAL_EFFECTS_DIR = 'features/room/components/RoleRevealEffects';

/** Imports / calls that drive a per-frame JS loop. `loopMotion` itself is the only allowed consumer. */
const FORBIDDEN_IN_DECORATIONS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'useAnimatedProps', pattern: /\buseAnimatedProps\b/ },
  { name: 'useAnimatedStyle', pattern: /\buseAnimatedStyle\b/ },
  { name: 'useSharedValue', pattern: /\buseSharedValue\b/ },
  { name: 'withRepeat', pattern: /\bwithRepeat\b/ },
  { name: 'useFrameCallback', pattern: /\buseFrameCallback\b/ },
  { name: 'svgAnimatedPrimitives', pattern: /svgAnimatedPrimitives/ },
  { name: 'Animated.createAnimatedComponent', pattern: /createAnimatedComponent\(/ },
];

const INFINITE_REPEAT = /withRepeat\(([\s\S]*?),\s*-1\s*[,)]/;

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      results.push(...listSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories)\./.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('persistent decorations are compositor-only', () => {
  const files = PERSISTENT_DECORATION_DIRS.flatMap((dir) =>
    listSourceFiles(path.join(SRC_ROOT, dir)),
  );

  it('scans the decoration folders', () => {
    expect(files.length).toBeGreaterThan(90);
  });

  it.each(files.map((file) => [path.relative(SRC_ROOT, file), file]))(
    '%s does not drive a JS-thread animation loop',
    (_relative, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_IN_DECORATIONS.filter(({ pattern }) => pattern.test(source)).map(
        ({ name }) => name,
      );
      expect(hits).toEqual([]);
    },
  );
});

describe('one-shot reveal effects cancel their infinite loops', () => {
  const files = listSourceFiles(path.join(SRC_ROOT, REVEAL_EFFECTS_DIR));
  const withInfiniteRepeat = files.filter((file) =>
    INFINITE_REPEAT.test(fs.readFileSync(file, 'utf8')),
  );

  it('still has infinite loops to guard', () => {
    expect(withInfiniteRepeat.length).toBeGreaterThan(10);
  });

  it.each(withInfiniteRepeat.map((file) => [path.relative(SRC_ROOT, file), file]))(
    '%s calls cancelAnimation',
    (_relative, file) => {
      expect(fs.readFileSync(file, 'utf8')).toMatch(/\bcancelAnimation\(/);
    },
  );
});

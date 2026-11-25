/**
 * Contract test: one avatar shape.
 *
 * `Avatar` owns its corners (`AVATAR_CORNER_RATIO`, at every size) and the scene draws avatar
 * frames along the same corner. No stylesheet outside `components/avatar/` may restyle the avatar
 * element's corners or clip it, so the shape cannot drift per page again.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');
const AVATAR_DIR = 'components/avatar/';

/** A selector whose subject (last compound) is the avatar element itself. */
const TARGETS_AVATAR = /\.avatar(?![-\w])[^\s>+~]*$/;
const SHAPE_PROPERTY = /^\s*(?:border(?:-[a-z]+)*-radius|clip-path|mask(?:-[a-z]+)*)\s*:/m;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return cssFiles(fullPath);
    return entry.endsWith('.css') ? [fullPath] : [];
  });
}

/** `selector → declarations` for every rule, comments removed; at-rule wrappers are skipped. */
function rules(source: string): { selector: string; body: string }[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').trim(),
    body: match[2] ?? '',
  }));
}

describe('Avatar shape', () => {
  it('is set by Avatar alone', () => {
    const overrides = cssFiles(SRC_DIR)
      .filter((file) => !relative(SRC_DIR, file).startsWith(AVATAR_DIR))
      .flatMap((file) =>
        rules(readFileSync(file, 'utf8'))
          .filter(
            ({ selector, body }) =>
              selector.split(',').some((part) => TARGETS_AVATAR.test(part.trim())) &&
              SHAPE_PROPERTY.test(body),
          )
          .map(({ selector }) => `${relative(SRC_DIR, file)}: ${selector}`),
      );
    expect(overrides).toEqual([]);
  });

  it('keeps the shape out of the avatar stylesheet', () => {
    // Avatar sets its corners inline from AVATAR_CORNER_RATIO; a stylesheet radius would be a
    // second source that the inline value silently wins over.
    const css = readFileSync(join(SRC_DIR, AVATAR_DIR, 'Avatar.css'), 'utf8');
    const avatarRules = rules(css).filter(({ selector }) =>
      selector.split(',').some((part) => TARGETS_AVATAR.test(part.trim())),
    );
    expect(avatarRules.length).toBeGreaterThan(0);
    expect(avatarRules.filter(({ body }) => SHAPE_PROPERTY.test(body))).toEqual([]);
  });
});

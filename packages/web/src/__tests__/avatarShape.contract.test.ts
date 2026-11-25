/**
 * Contract test: one avatar shape.
 *
 * `Avatar` owns its corners (`AVATAR_CORNER_RATIO`, at every size) and the scene draws avatar
 * frames along the same corner. No stylesheet but `Avatar.css` (pinned below) may restyle the avatar
 * element's corners, nor clip an avatar wrapper (an `*avatar*` class with `overflow: hidden|clip`
 * plus a radius, or any clip-path/mask), so the shape cannot drift per page again. Declarations
 * are merged per selector within a file, so splitting a clip across two rules does not hide it.
 *
 * Every element that hosts an `<Avatar>` is registered in `AVATAR_HOSTS`, whatever its class is
 * called; the census of `<Avatar>` sites fails when a site is added, so its host gets registered.
 * Avatar artwork reaches the page only through `<Avatar>`: no bare `<img>` of a portrait URL.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');
const AVATAR_CSS = 'components/avatar/Avatar.css';

/** A selector whose subject (last compound) is the avatar element itself. */
const TARGETS_AVATAR = /\.avatar(?![-\w])[^\s>+~]*$/;
const SHAPE_PROPERTY = /^\s*(?:border(?:-[a-z]+)*-radius|clip-path|mask(?:-[a-z]+)*)\s*:/m;
/** Any compound in the selector names an avatar-ish class (`.seat-avatar`, `.room-user-avatar-clip`). */
const NAMES_AVATAR = /\.[\w-]*avatar[\w-]*/;
const CLIPS_CONTENT = /^\s*overflow(?:-[xy])?\s*:\s*(?:hidden|clip)\b/m;
const RADIUS = /^\s*border(?:-[a-z]+)*-radius\s*:/m;
const CLIP_SHAPE = /^\s*(?:clip-path|mask(?:-[a-z]+)*)\s*:/m;

/**
 * Class of every element that directly hosts an `<Avatar>` (sizes it, or is its frame / tile).
 * A host may set its own radius, but must not cut the avatar: no `overflow: hidden|clip` with a
 * radius, no clip-path/mask, and no radius on a descendant that could be the avatar.
 */
const AVATAR_HOSTS: readonly string[] = [
  'account-entry',
  'appearance-avatar-preview',
  'appearance-cell-thumb',
  'login-strip-portrait',
  'profile-equip-preview',
  'resident-tile-avatar',
  'reward-preview',
  'seat-avatar',
  'settings-teaser-item',
  'undercover-reveal-identity',
  'unlocks-thumb',
];

/** Production `<Avatar>` sites per file. Adding one? Register its host in `AVATAR_HOSTS`. */
const AVATAR_SITES: Readonly<Record<string, number>> = {
  'components/avatar/AccountAvatar.tsx': 1,
  'features/auth/LoginDialog.tsx': 1,
  'features/product/components/ResidentPreview.tsx': 1,
  'features/room/components/ProfileEquipmentShowcase.tsx': 1,
  'features/room/components/RoomSeatTile.tsx': 1,
  'games/undercover/room/components/UndercoverRevealModal.tsx': 1,
  'routes/appearance/AppearancePage.tsx': 1,
  'routes/appearance/AppearancePickers.tsx': 3,
  'routes/gacha/components/RewardPreview.tsx': 1,
  'routes/settings/SettingsPage.tsx': 1,
  'routes/unlocks/UnlocksPage.tsx': 1,
};

/** Role cards reuse the avatar art as role portraits; they are not user avatars. */
const ROLE_ART = /^games\/[\w-]+\/assets\/roleAvatars\.ts$/;
/** Avatar artwork, or an `avatarSources` export that turns an avatar into an image URL. */
const AVATAR_IMAGE_SOURCE =
  /assets\/avatars\/|\b(?:getHandDrawnPortraitUrl|resolveAvatarSource|HAND_DRAWN_PORTRAITS)\b/;

/** The last compound of a selector part: the element the rule styles. */
function subjectOf(part: string): string {
  return (
    part
      .trim()
      .split(/\s*[\s>+~]\s*/)
      .at(-1) ?? ''
  );
}

/** Could this compound match the avatar element (no class but `.avatar`, if any)? */
function mayBeAvatar(compound: string): boolean {
  const withoutNegations = compound.replace(/:not\([^)]*\)/g, '');
  return [...withoutNegations.matchAll(/\.([\w-]+)/g)].every(([, name]) => name === 'avatar');
}

function hostIn(part: string): string | undefined {
  return AVATAR_HOSTS.find((host) => new RegExp(`\\.${host}(?![-\\w])`).test(part));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(fullPath);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return cssFiles(fullPath);
    return entry.endsWith('.css') ? [fullPath] : [];
  });
}

/**
 * `selector → declarations` for every rule, comments removed; at-rule wrappers are skipped. Rules
 * repeating a selector are merged, so a split declaration is judged as one rule.
 */
function rules(source: string): { selector: string; body: string }[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const merged = new Map<string, string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    merged.set(selector, `${merged.get(selector) ?? ''}\n${match[2] ?? ''}`);
  }
  return [...merged].map(([selector, body]) => ({ selector, body }));
}

/** Every stylesheet except Avatar's own, whose shape is pinned separately. */
function otherCssFiles(): string[] {
  return cssFiles(SRC_DIR).filter((file) => relative(SRC_DIR, file) !== AVATAR_CSS);
}

describe('Avatar shape', () => {
  it('is set by Avatar alone', () => {
    const overrides = otherCssFiles().flatMap((file) =>
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

  it('is not cut by an avatar wrapper', () => {
    const clippers = otherCssFiles().flatMap((file) =>
      rules(readFileSync(file, 'utf8'))
        .filter(
          ({ selector, body }) =>
            NAMES_AVATAR.test(selector) &&
            ((CLIPS_CONTENT.test(body) && RADIUS.test(body)) || CLIP_SHAPE.test(body)),
        )
        .map(({ selector }) => `${relative(SRC_DIR, file)}: ${selector}`),
    );
    expect(clippers).toEqual([]);
  });

  it('is not cut by the element hosting it', () => {
    const cutters = otherCssFiles().flatMap((file) =>
      rules(readFileSync(file, 'utf8')).flatMap(({ selector, body }) =>
        selector
          .split(',')
          .filter((part) => {
            const host = hostIn(part);
            if (host === undefined) return false;
            if (CLIP_SHAPE.test(body)) return true;
            const subject = subjectOf(part);
            if (hostIn(subject) === host) return CLIPS_CONTENT.test(body) && RADIUS.test(body);
            return mayBeAvatar(subject) && (RADIUS.test(body) || CLIPS_CONTENT.test(body));
          })
          .map((part) => `${relative(SRC_DIR, file)}: ${part.trim()}`),
      ),
    );
    expect(cutters).toEqual([]);
  });

  it('has every site registered, so its host is checked', () => {
    const sites: Record<string, number> = {};
    for (const file of sourceFiles(SRC_DIR).filter((path) => path.endsWith('.tsx'))) {
      const count = (readFileSync(file, 'utf8').match(/<Avatar(?=[\s/>])/g) ?? []).length;
      if (count !== 0) sites[relative(SRC_DIR, file)] = count;
    }
    expect(sites).toEqual(AVATAR_SITES);
  });

  it('reaches the page only through Avatar', () => {
    const bypasses = sourceFiles(SRC_DIR)
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => !file.startsWith('components/avatar/') && !ROLE_ART.test(file))
      .filter((file) => AVATAR_IMAGE_SOURCE.test(readFileSync(join(SRC_DIR, file), 'utf8')));
    expect(bypasses).toEqual([]);
  });

  it('keeps the shape out of the avatar stylesheet', () => {
    // Avatar sets its corners inline from AVATAR_CORNER_RATIO; a stylesheet radius would be a
    // second source that the inline value silently wins over.
    const css = readFileSync(join(SRC_DIR, AVATAR_CSS), 'utf8');
    const avatarRules = rules(css).filter(({ selector }) =>
      selector.split(',').some((part) => TARGETS_AVATAR.test(part.trim())),
    );
    expect(avatarRules.length).toBeGreaterThan(0);
    expect(avatarRules.filter(({ body }) => SHAPE_PROPERTY.test(body))).toEqual([]);
  });
});

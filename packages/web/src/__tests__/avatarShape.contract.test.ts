/**
 * Contract test: one avatar shape.
 *
 * `Avatar` owns its corners (`AVATAR_CORNER_RATIO`, at every size; `Avatar.test.tsx` pins the
 * value) and the scene draws avatar frames along the same corner. Stylesheets are parsed with
 * PostCSS: nested rules resolve against their parents, `@scope` prefixes its root, other at-rules
 * are transparent, `-webkit-` prefixes are dropped and a selector's rules are merged. No
 * stylesheet may restyle the avatar's corners (`Avatar.css` may style its own elements, with no
 * shape, and is checked like any other beyond them), no rule on an `<img>`, a `<span>` or any
 * element without a class may shape what could be the avatar, and no avatar wrapper (an
 * `*avatar*` class with `overflow: hidden|clip` plus a radius, or any clip-path/mask) may clip
 * it. From script, only the seat entrance's wipe clips an element.
 *
 * Every element that hosts an `<Avatar>` is registered in `AVATAR_HOSTS`, whatever its class is
 * called. A census parses the source files that name a carrier (`<Avatar>`, `<ResidentAvatarTile>`,
 * aliases, components returning one) and records the elements from each site out to its box;
 * adding a site or wrapping one in a new element changes it and fails, and each class on the way
 * must be a registered host, stage or box, so the stylesheet checks below reach it. A class the
 * census cannot read fails too; what it can and cannot follow is listed in `avatarCensus.ts`.
 * Where a held site finally lands is stated beside its entry.
 * Avatar artwork reaches the page only through `<Avatar>`: no bare `<img>` of a portrait or an
 * uploaded avatar URL. Files hosting an `<Avatar>` set no inline corner, clip or overflow either.
 * An `<img>`'s `src` and an element's `style` are read with the TypeScript parser and followed
 * through the names they use that the file declares (a `.map` callback's parameter through its
 * receiver), not through props from another component.
 *
 * A square box around an avatar (a seat, a tile, a mat, an avatar-sized placeholder) is
 * concentric with it: it carries `AVATAR_CONCENTRIC_CLASS`, whose one rule (in its own
 * stylesheet, the only one that may shape that class) derives its corners from the published
 * ratio and the box's own `--avatar-inset`; the box sets no radius, clip-path or mask of its own
 * (`inherit` on a pseudo element lining it is fine). Every host names the box drawn around its
 * avatar; a host that is not itself such a box, and the entrance stages between a box and its
 * avatar, set no corners or cut at all. No stylesheet but the concentric rule's names the ratio,
 * and that one only reads it; no source but `config/avatarShape.ts`, which publishes it, names
 * its property. A box reads whether its tile wears a frame only via `wearsFrame`.
 *
 * Not checked: an element of its own drawn over an avatar inside its host (an overlay or a badge
 * is not told apart by its class), a selector reaching a host or box itself by tag or attribute
 * rather than by its class, a wrapper outside a host with no box, and a wrong `--avatar-inset`
 * value.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import postcss, { type Container, list } from 'postcss';
import ts from 'typescript';

import { AVATAR_CONCENTRIC_CLASS } from '@/components/avatar/avatarConcentric';
import {
  applyAvatarShapeTokens,
  AVATAR_CORNER_RATIO,
  AVATAR_CORNER_RATIO_PROPERTY,
} from '@/config/avatarShape';

import { avatarCensus, type DeclarationRef } from './avatarCensus';

const SRC_DIR = join(import.meta.dirname, '..');
const AVATAR_CSS = 'components/avatar/Avatar.css';
const CONCENTRIC_CSS = 'components/avatar/avatarConcentric.css';

/** A selector whose subject (last compound) is the avatar element itself. */
const TARGETS_AVATAR = /\.avatar(?![-\w])[^\s>+~]*$/;
/** A declaration of one of `properties` in a rule body, on its own line or after a `;`. */
const declares = (properties: string, value = '') =>
  new RegExp(`(?:^|;)\\s*(?:${properties})\\s*:${value}`, 'm');
const RADIUS_PROPERTY = 'border(?:-[a-z]+)*-radius|corner-shape';
const CLIP_PROPERTY = 'clip-path|mask(?:-[a-z]+)*';
const SHAPE_PROPERTY = declares(`${RADIUS_PROPERTY}|${CLIP_PROPERTY}`);
/** Any compound in the selector names an avatar-ish class (`.seat-avatar`, `.room-user-avatar-clip`). */
const NAMES_AVATAR = /\.[\w-]*avatar[\w-]*/;
const CLIPS_CONTENT = declares('overflow(?:-[xy])?', '\\s*(?:hidden|clip)\\b');
const RADIUS = declares(RADIUS_PROPERTY);
const CLIP_SHAPE = declares(CLIP_PROPERTY);
/**
 * Corners or a cut of an element's own, other than taking its parent's (`inherit`, as a pseudo
 * element lining a box does).
 */
const OWN_SHAPE = declares(`${RADIUS_PROPERTY}|${CLIP_PROPERTY}`, '(?!\\s*inherit\\s*(?:;|$))');

/**
 * Class of every element that directly hosts an `<Avatar>` (sizes it, or is its frame / tile).
 * A host may set its own radius, but must not cut the avatar: no `overflow: hidden|clip` with a
 * radius, no clip-path/mask, and no radius on a descendant that could be the avatar.
 */
const AVATAR_HOSTS: readonly string[] = [
  'account-entry',
  'appearance-avatar-preview',
  'appearance-cell-thumb',
  'appearance-hero-avatar',
  'login-strip-portrait',
  'profile-equip-preview',
  'resident-tile-avatar',
  'reward-preview',
  'seat-avatar',
  'settings-teaser-item',
  'undercover-reveal-identity',
  'unlocks-thumb',
];

/**
 * The box drawn around each host's avatar: a concentric box class (the host's own, when the host
 * is that box), or `null` when the avatar sits bare in a padded card, a dialog or a link. Either
 * way the host itself sets no corners unless it is the concentric box (pinned below).
 */
const HOST_BOXES: Readonly<Record<string, string | null>> = {
  'account-entry': null,
  'appearance-avatar-preview': null,
  'appearance-cell-thumb': 'appearance-cell',
  'appearance-hero-avatar': null,
  'login-strip-portrait': null,
  'profile-equip-preview': 'profile-equip-preview',
  'resident-tile-avatar': 'resident-tile',
  'reward-preview': null,
  'seat-avatar': 'seat-tile-button',
  'settings-teaser-item': null,
  'undercover-reveal-identity': null,
  'unlocks-thumb': 'unlocks-cell-frame',
};

/**
 * Every concentric box and the file that gives it `AVATAR_CONCENTRIC_CLASS`: the host boxes above,
 * the boxes around a tile (the profile mat, the settings link), the seat's emphasis ring, and the
 * placeholders that stand where an avatar would (the settings teaser lock, the admin user table's
 * initial).
 */
const CONCENTRIC_BOXES: Readonly<Record<string, string>> = {
  'admin-avatar': 'routes/admin/pages/UsersPage.tsx',
  'appearance-cell': 'routes/appearance/AppearancePickers.tsx',
  'appearance-cell-upload': 'routes/appearance/AppearancePickers.tsx',
  'profile-avatar': 'features/room/components/PlayerProfileCard.tsx',
  'profile-equip-preview': 'features/room/components/ProfileEquipmentShowcase.tsx',
  'resident-tile': 'features/product/components/ResidentPreview.tsx',
  'seat-status-emphasis': 'features/room/components/RoomSeatTile.tsx',
  'seat-tile-button': 'features/room/components/RoomSeatTile.tsx',
  'settings-avatar': 'routes/settings/SettingsPage.tsx',
  'settings-teaser-lock': 'routes/settings/SettingsPage.tsx',
  'unlocks-cell-frame': 'routes/unlocks/UnlocksPage.tsx',
};

/** The wrappers between a box and its avatar that entrances animate (and ghost copies sit in). */
const AVATAR_STAGES: readonly string[] = [
  'resident-tile-ghosts',
  'resident-tile-stage',
  'seat-avatar-ghosts',
  'seat-avatar-stage',
];

/**
 * The census (`avatarCensus.ts`): per file, each avatar site as `<Carrier> in <chain>`, the
 * elements from the site out to the box drawn around it (`a < b < box`). An element reads as its
 * classes, or `<Tag>` when it has none; a component (`<Tag>`, with its classes) ends the chain. A
 * site a function returns ends in `returned by <Fn>` (the function is then a carrier, listed where
 * it is rendered); one stored in a `const` or an object property ends in `held by <name>` and is
 * traced again from each read (`via <name>`, `via .<prop>`), and one passed to a component of
 * this app is traced again from where the component reads that prop (`via <Tag>.<prop>`).
 */
const AVATAR_SITES: Readonly<Record<string, readonly string[]>> = {
  // Its callers wrap it in `account-entry` (ACCOUNT_ENTRY_CLASS), listed where they render it.
  'components/avatar/AccountAvatar.tsx': ['Avatar in returned by AccountAvatar'],
  'features/auth/LoginDialog.tsx': ['Avatar in login-strip-portrait'],
  'features/product/components/ResidentPreview.tsx': [
    'Avatar in resident-tile-avatar < resident-tile-stage < resident-tile avatar-concentric',
  ],
  'features/room/components/PlayerProfileCard.tsx': [
    'ResidentAvatarTile in profile-avatar avatar-concentric',
    'ResidentAvatarTile in profile-avatar avatar-concentric',
  ],
  // The avatar slot's preview, read back as `slot.preview` into the slot's box.
  'features/room/components/ProfileEquipmentShowcase.tsx': [
    'Avatar in held by preview',
    'via preview in held by .preview',
    'via preview in held by .preview',
    'via .preview in profile-equip-preview avatar-concentric',
  ],
  'features/room/components/RoomSeatTile.tsx': [
    'Avatar in seat-avatar < seat-avatar-stage < seat-tile-button avatar-concentric',
  ],
  'features/room/components/RoomShell.tsx': ['AccountAvatar in account-entry'],
  'games/undercover/room/components/UndercoverRevealModal.tsx': [
    'Avatar in undercover-reveal-identity',
  ],
  // The hero's avatar sits bare on the hero card.
  'routes/appearance/AppearanceHero.tsx': [
    'ResidentAvatarTile in appearance-hero-avatar',
    'ResidentAvatarTile in appearance-hero-avatar',
  ],
  'routes/appearance/AppearancePage.tsx': ['Avatar in appearance-avatar-preview'],
  // PickerCell draws `appearance-cell` > `appearance-cell-thumb`; the bare span is that thumb's
  // custom-upload preview.
  'routes/appearance/AppearancePickers.tsx': [
    'via PickerCell.children in appearance-cell-thumb < appearance-cell avatar-concentric',
    'Avatar in <PickerCell>',
    'Avatar in <PickerCell>',
    'Avatar in <span> < <PickerCell>',
    'ResidentAvatarTile in <PickerCell>',
  ],
  'routes/gacha/components/RewardPreview.tsx': [
    'ResidentAvatarTile in held by body',
    'Avatar in held by body',
    'via body in reward-preview',
  ],
  'routes/home/HomePage.tsx': ['AccountAvatar in <Link> account-entry'],
  'routes/settings/SettingsPage.tsx': [
    'Avatar in settings-teaser-item',
    'ResidentAvatarTile in <Link> settings-avatar avatar-concentric',
  ],
  'routes/unlocks/UnlocksPage.tsx': [
    'Avatar in unlocks-thumb < returned by UnlockThumb',
    'ResidentAvatarTile in returned by UnlockThumb',
    'UnlockThumb in unlocks-cell-frame avatar-concentric',
  ],
};

/** The elements that carry an avatar into the page wherever they are rendered. */
const AVATAR_CARRIERS: readonly DeclarationRef[] = [
  { file: 'components/avatar/Avatar.tsx', name: 'Avatar' },
  { file: 'features/product/components/ResidentPreview.tsx', name: 'ResidentAvatarTile' },
];

/** Role cards reuse the avatar art as role portraits; they are not user avatars. */
const ROLE_ART = /^games\/[\w-]+\/assets\/roleAvatars\.ts$/;
/** Avatar artwork, or an `avatarSources` export that turns an avatar into an image URL. */
const AVATAR_IMAGE_SOURCE =
  /assets\/avatars\/|\b(?:getHandDrawnPortraitUrl|resolveAvatarSource|HAND_DRAWN_PORTRAITS)\b/;

/**
 * The value of every `attribute` on a `tag` element (any tag when undefined) in a TSX source,
 * with what it is computed from: for each name it uses that the file declares, that declaration
 * (a `const`'s initializer, a destructured property with its source, a parameter, and, for a
 * parameter of a callback such as `.map`, the receiver it is called on), followed on through the
 * names they use. Names are matched across the file, so a reuse of a name only adds text.
 */
function attributeValues(path: string, attribute: string, tag?: string): ts.Node[][] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = new Map<string, ts.Node[]>();
  const values: ts.Node[] = [];
  const collect = (node: ts.Node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isBindingElement(node) || ts.isParameter(node)) &&
      ts.isIdentifier(node.name)
    ) {
      declarations.set(node.name.text, [...(declarations.get(node.name.text) ?? []), node]);
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      (tag === undefined || node.tagName.getText() === tag)
    ) {
      for (const property of node.attributes.properties) {
        if (ts.isJsxAttribute(property) && property.name.getText() === attribute) {
          if (property.initializer !== undefined) values.push(property.initializer);
        }
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  return values.map((value) => {
    const reached: ts.Node[] = [];
    const seen = new Set<ts.Node>();
    const expand = (node: ts.Node) => {
      if (seen.has(node)) return;
      seen.add(node);
      reached.push(node);
      const visit = (child: ts.Node) => {
        if (ts.isIdentifier(child)) {
          for (const declaration of declarations.get(child.text) ?? []) {
            // A destructured name carries the object it is taken from.
            expand(ts.isBindingElement(declaration) ? declaration.parent.parent : declaration);
            const fn = declaration.parent;
            const call = ts.isParameter(declaration) ? fn.parent : undefined;
            if (
              call !== undefined &&
              ts.isCallExpression(call) &&
              ts.isPropertyAccessExpression(call.expression)
            ) {
              expand(call.expression.expression);
            }
          }
        }
        ts.forEachChild(child, visit);
      };
      if (ts.isIdentifier(node)) visit(node);
      else ts.forEachChild(node, visit);
    };
    expand(value);
    return reached;
  });
}

/** A style key, normalized (`border-radius`, `WebkitBorderRadius` → `borderradius`). */
const styleKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[-_]/g, '')
    .replace(/^webkit/, '');
/** A style key that could cut or re-shape a hosted avatar. */
const INLINE_SHAPE =
  /^(?:border\w*radius|clippath|mask\w*|overflow[xy]?|cornershape|avatarcornerratio)$/;

/** The keys an inline style may set: those of every object literal it reaches (`?` if computed). */
function styleKeys(reached: readonly ts.Node[]): string[] {
  const keys: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralElementLike(node) && node.name !== undefined) {
      const name = node.name;
      keys.push(
        ts.isIdentifier(name) ||
          ts.isStringLiteral(name) ||
          ts.isNoSubstitutionTemplateLiteral(name)
          ? name.text
          : '?',
      );
    }
    ts.forEachChild(node, visit);
  };
  reached.forEach(visit);
  return keys;
}

/** The compounds of a selector part, split at combinators outside brackets and parentheses. */
function compoundsOf(part: string): string[] {
  const compounds = [''];
  let depth = 0;
  for (const char of part.trim()) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (compounds.at(-1) !== '') compounds.push('');
    } else {
      compounds[compounds.length - 1] += char;
    }
  }
  return compounds.filter((compound) => compound !== '');
}

/** The last compound of a selector part: the element the rule styles. */
function subjectOf(part: string): string {
  return compoundsOf(part).at(-1) ?? '';
}

/** A compound without its `:not(…)` negations (which never narrow what it may match to a class). */
const stripNot = (compound: string) => compound.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');

/** Could this compound match the avatar element (no class but `.avatar`, if any)? */
function mayBeAvatar(compound: string): boolean {
  return [...stripNot(compound).matchAll(/\.([\w-]+)/g)].every(([, name]) => name === 'avatar');
}

/**
 * Does a rule with this subject give it corners or a cut of its own? A pseudo element may take
 * its element's corners (`inherit`); the element itself may not take its parent's.
 */
const shapes = (subject: string, body: string) =>
  (subject.includes('::') ? OWN_SHAPE : SHAPE_PROPERTY).test(body);

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

/** A style rule: its selector parts and its declarations, one `property: value;` per line. */
interface CssRule {
  readonly selector: string;
  readonly parts: readonly string[];
  readonly body: string;
}

/** Child selectors nested in `parents` (`&` stands for the parent; otherwise a descendant). */
function nest(parents: readonly string[] | undefined, selectors: readonly string[]): string[] {
  if (parents === undefined) return [...selectors];
  return parents.flatMap((parent) =>
    selectors.map((selector) =>
      selector.includes('&') ? selector.replaceAll('&', parent) : `${parent} ${selector}`,
    ),
  );
}

/**
 * Every style rule of a stylesheet, parsed by PostCSS: nested rules are resolved against their
 * parents, `@scope (root)` prefixes its root, and other at-rules (`@media`, `@supports`, …) are
 * transparent. Properties are lowercased with any `-webkit-` prefix dropped. Rules repeating a
 * selector are merged, so a split declaration is judged as one rule.
 */
function rules(source: string): CssRule[] {
  const merged = new Map<string, { parts: string[]; body: string }>();
  const walk = (container: Container, parents: string[] | undefined) => {
    const declarations: string[] = [];
    container.each((node) => {
      if (node.type === 'decl') {
        declarations.push(`${node.prop.toLowerCase().replace(/^-webkit-/, '')}: ${node.value};`);
      } else if (node.type === 'rule') {
        walk(node, nest(parents, node.selectors));
      } else if (node.type === 'atrule' && node.nodes !== undefined) {
        const root =
          node.name.toLowerCase() === 'scope' ? /^\s*\(([^)]*)\)/.exec(node.params) : null;
        walk(node, root?.[1] === undefined ? parents : nest(parents, list.comma(root[1])));
      }
    });
    if (parents === undefined || declarations.length === 0) return;
    const parts = parents.map((part) => part.replaceAll(':scope', '').trim() || ':scope');
    const selector = parts.join(', ');
    const entry = merged.get(selector) ?? { parts, body: '' };
    merged.set(selector, { parts, body: `${entry.body}\n${declarations.join('\n')}` });
  };
  walk(postcss.parse(source), undefined);
  return [...merged].map(([selector, { parts, body }]) => ({ selector, parts, body }));
}

/** The classes `Avatar` gives its own elements, read from its source. */
const AVATAR_OWN_CLASSES = [
  ...readFileSync(join(SRC_DIR, 'components/avatar/Avatar.tsx'), 'utf8').matchAll(
    /className="([^"]*)"/g,
  ),
].flatMap(([, names]) => (names ?? '').split(/\s+/).filter((name) => name !== ''));

/** Does this compound select only through the avatar's own classes (and attributes, states)? */
function ownAvatarCompound(compound: string): boolean {
  const classes = [...compound.matchAll(/\.([\w-]+)/g)].map(([, name]) => name ?? '');
  const rest = compound.replace(/\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?/g, '');
  return (
    classes.length > 0 && classes.every((name) => AVATAR_OWN_CLASSES.includes(name)) && rest === ''
  );
}

/**
 * Every stylesheet's rules. `Avatar.css` keeps only the rules that reach beyond the avatar's own
 * elements (the classes `Avatar` renders): its rules on those are pinned separately below.
 */
function sheets(): { file: string; rules: CssRule[] }[] {
  return cssFiles(SRC_DIR).map((path) => {
    const file = relative(SRC_DIR, path);
    const all = rules(readFileSync(path, 'utf8'));
    return {
      file,
      rules:
        file === AVATAR_CSS
          ? all.filter(({ parts }) =>
              parts.some((part) => !compoundsOf(part).every(ownAvatarCompound)),
            )
          : all,
    };
  });
}

/** Does this compound style the concentric box `.<name>` (not its non-concentric variant)? */
function styles(compound: string, name: string): boolean {
  const negated = [...compound.matchAll(/:not\(((?:[^()]|\([^()]*\))*)\)/g)].map(([, inner]) =>
    (inner ?? '').trim(),
  );
  if (negated.includes(`.${AVATAR_CONCENTRIC_CLASS}`)) return false;
  return new RegExp(`\\.${name}(?![-\\w])`).test(compound);
}

/** Classes that end a chain: the box drawn around the avatar, or a host with no box. */
function endsChain(names: readonly string[]): boolean {
  return names.some(
    (name) =>
      name in CONCENTRIC_BOXES || (AVATAR_HOSTS.includes(name) && HOST_BOXES[name] === null),
  );
}

const words = (text: string) => text.split(/\s+/).filter((word) => word !== '');

function readSource(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** The census of the app's sources (`avatarCensus.ts`). */
function appCensus(): Record<string, string[]> {
  return avatarCensus({
    srcDir: SRC_DIR,
    files: sourceFiles(SRC_DIR).filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts')),
    read: readSource,
    carriers: AVATAR_CARRIERS.map(({ file, name }) => ({ file: join(SRC_DIR, file), name })),
    endsChain,
  });
}

describe('Avatar shape', () => {
  it('is set by Avatar alone', () => {
    const overrides = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules
        .filter(
          ({ parts, body }) =>
            parts.some((part) => TARGETS_AVATAR.test(part.trim())) && SHAPE_PROPERTY.test(body),
        )
        .map(({ selector }) => `${file}: ${selector}`),
    );
    expect(overrides).toEqual([]);
  });

  it('is not re-shaped by a rule that could select it without a class', () => {
    // The avatar is an `<img>` or a `<span>`: a rule on such a tag (or `*`, or no tag) with no class
    // reaches it when nothing scopes it to another element, or when it is scoped inside an avatar,
    // a host, a stage or a box; so does any rule on an element inside an avatar.
    const around = [...AVATAR_HOSTS, ...AVATAR_STAGES, ...Object.keys(CONCENTRIC_BOXES), 'avatar'];
    const reaching = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules.flatMap(({ parts, body }) =>
        parts
          .filter((part) => {
            const compounds = compoundsOf(part);
            const subject = compounds.at(-1) ?? '';
            const ancestors = compounds.slice(0, -1);
            const classes = (c: string) =>
              [...stripNot(c).matchAll(/\.([\w-]+)/g)].map(([, n]) => n ?? '');
            const inAvatar = ancestors.some((c) => classes(c).includes('avatar'));
            const bare =
              /^(?:img|span|\*)?(?![\w-])/i.test(subject) && classes(subject).length === 0;
            const scopes = ancestors.flatMap(classes);
            const reaches =
              inAvatar ||
              (bare && (scopes.length === 0 || scopes.some((name) => around.includes(name))));
            return reaches && shapes(subject, body);
          })
          .map((part) => `${file}: ${part.trim()}`),
      ),
    );
    expect(reaching).toEqual([]);
  });

  it('is not cut by an avatar wrapper', () => {
    const clippers = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules
        .filter(
          ({ selector, body }) =>
            NAMES_AVATAR.test(selector) &&
            ((CLIPS_CONTENT.test(body) && RADIUS.test(body)) || CLIP_SHAPE.test(body)),
        )
        .map(({ selector }) => `${file}: ${selector}`),
    );
    expect(clippers).toEqual([]);
  });

  it('is not cut by the element hosting it', () => {
    const cutters = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules.flatMap(({ parts, body }) =>
        parts
          .filter((part) => {
            const host = hostIn(part);
            if (host === undefined) return false;
            if (CLIP_SHAPE.test(body)) return true;
            const subject = subjectOf(part);
            if (hostIn(subject) === host) return CLIPS_CONTENT.test(body) && RADIUS.test(body);
            return mayBeAvatar(subject) && (RADIUS.test(body) || CLIPS_CONTENT.test(body));
          })
          .map((part) => `${file}: ${part.trim()}`),
      ),
    );
    expect(cutters).toEqual([]);
  });

  it('has every site registered with the elements around it', () => {
    const census = appCensus();
    expect(census).toEqual(AVATAR_SITES);
    // Each class around a site is a host, a stage or a concentric box, so the stylesheet checks
    // reach it; anything the census cannot read (`?`) is no such class, so it fails too.
    const registered = new Set([
      ...AVATAR_HOSTS,
      ...AVATAR_STAGES,
      ...Object.keys(CONCENTRIC_BOXES),
      AVATAR_CONCENTRIC_CLASS,
    ]);
    const unregistered = Object.values(census)
      .flat()
      .flatMap((site) => site.slice(site.indexOf(' in ') + ' in '.length).split(' < '))
      .filter((link) => !/^(?:returned|held) by /.test(link))
      .flatMap((link) => words(link.replace(/^own /, '').replace(/^<[^>]*>/, '')))
      .filter((name) => !registered.has(name));
    expect(unregistered).toEqual([]);
  });

  it('reaches the page only through Avatar', () => {
    const bypasses = sourceFiles(SRC_DIR)
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => !file.startsWith('components/avatar/') && !ROLE_ART.test(file))
      .filter((file) => AVATAR_IMAGE_SOURCE.test(readFileSync(join(SRC_DIR, file), 'utf8')));
    expect(bypasses).toEqual([]);
  });

  it('is never drawn as a bare <img> of an avatar URL', () => {
    const bareImages = sourceFiles(SRC_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => !file.startsWith('components/avatar/'))
      .flatMap((file) =>
        attributeValues(join(SRC_DIR, file), 'src', 'img')
          .filter((reached) => reached.some((node) => /avatarurl/i.test(node.getText())))
          .map((reached) => `${file}: src=${reached[0]?.getText() ?? ''}`),
      );
    expect(bareImages).toEqual([]);
  });

  it('is not re-shaped by inline styles where it is hosted or boxed', () => {
    const files = new Set([...Object.keys(AVATAR_SITES), ...Object.values(CONCENTRIC_BOXES)]);
    const inlineShapes = [...files].flatMap((file) =>
      attributeValues(join(SRC_DIR, file), 'style').flatMap((reached) =>
        styleKeys(reached)
          .filter((key) => key === '?' || INLINE_SHAPE.test(styleKey(key)))
          .map((key) => `${file}: style ${reached[0]?.getText() ?? ''} sets ${key}`),
      ),
    );
    expect(inlineShapes).toEqual([]);
  });

  it('is not re-shaped from script but by the seat entrance', () => {
    // The seat entrance wipes the avatar in with an inset clip while it plays; nothing else sets a
    // corner, clip or mask on an element from script.
    const imperative = sourceFiles(SRC_DIR)
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => file !== 'scene/SeatEntrance.tsx')
      .flatMap((file) =>
        [
          ...readFileSync(join(SRC_DIR, file), 'utf8').matchAll(
            /\.style\.(\w+)\s*=(?!=)|\.style\.setProperty\(\s*['"`]([\w-]+)/g,
          ),
        ]
          .map(([, key, property]) => key ?? property ?? '')
          .filter((key) => INLINE_SHAPE.test(styleKey(key)))
          .map((key) => `${file}: style.${key}`),
      );
    expect(imperative).toEqual([]);
  });

  it('names the box drawn around every host', () => {
    expect(Object.keys(HOST_BOXES).sort()).toEqual([...AVATAR_HOSTS].sort());
    const hostBoxes = Object.values(HOST_BOXES).filter((box) => box !== null);
    expect(hostBoxes.filter((box) => !(box in CONCENTRIC_BOXES))).toEqual([]);
  });

  it('gives every concentric box the shared class wherever it is drawn', () => {
    // The class joins the box's own in one template literal: `<box> ${AVATAR_CONCENTRIC_CLASS}`.
    // Only cards that hold no avatar go without it: the captioned appearance cell, and the unlock
    // cell previewing a name style or an icon.
    const bareAllowed: Readonly<Record<string, number>> = {
      'appearance-cell': 1,
      'unlocks-cell-frame': 1,
    };
    const wrong = Object.entries(CONCENTRIC_BOXES).flatMap(([box, file]) => {
      const source = readFileSync(join(SRC_DIR, file), 'utf8');
      const joined = '`' + box + ' ${AVATAR_CONCENTRIC_CLASS}`';
      const uses = source.match(new RegExp(`["'\`]${box}(?=["'\` ])`, 'g'))?.length ?? 0;
      const joinedUses = source.split(joined).length - 1;
      const bare = uses - joinedUses;
      return joinedUses === 0 || bare !== (bareAllowed[box] ?? 0) ? [`${file}: ${box}`] : [];
    });
    expect(wrong).toEqual([]);
  });

  it('lets no concentric box set its own corners or cut, and has each set its inset', () => {
    // The shared class itself is shaped in its own stylesheet alone.
    const others = sheets().filter(({ file }) => file !== CONCENTRIC_CSS);
    const ownShape: string[] = [];
    const withoutInset: string[] = [];
    for (const box of [...Object.keys(CONCENTRIC_BOXES), AVATAR_CONCENTRIC_CLASS]) {
      let setsInset = false;
      for (const { file, rules: sheetRules } of others) {
        for (const { selector, parts, body } of sheetRules) {
          const subjects = parts.map((part) => subjectOf(part)).filter((s) => styles(s, box));
          if (subjects.length === 0) continue;
          if (subjects.some((subject) => shapes(subject, body)))
            ownShape.push(`${file}: ${selector}`);
          if (declares('--avatar-inset').test(body)) setsInset = true;
        }
      }
      if (!setsInset && box !== AVATAR_CONCENTRIC_CLASS) withoutInset.push(box);
    }
    expect(ownShape).toEqual([]);
    expect(withoutInset).toEqual([]);
  });

  it('gives hosts that are not boxes, and the stages inside a box, no corners or cut', () => {
    const wrappers = [
      ...AVATAR_HOSTS.filter((host) => !(host in CONCENTRIC_BOXES)),
      ...AVATAR_STAGES,
    ];
    const cornered = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules
        .filter(({ parts, body }) =>
          parts.some((part) => {
            const subject = subjectOf(part);
            return wrappers.some((name) => styles(subject, name)) && shapes(subject, body);
          }),
        )
        .map(({ selector }) => `${file}: ${selector}`),
    );
    expect(cornered).toEqual([]);
  });

  it('names the ratio in no stylesheet but the concentric rule, which only reads it', () => {
    // Declaring it (or registering it with `@property`) would be a second ratio; reading it
    // elsewhere would be a second copy of the formula.
    const named = cssFiles(SRC_DIR)
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => file !== CONCENTRIC_CSS)
      .filter((file) =>
        readFileSync(join(SRC_DIR, file), 'utf8').includes(AVATAR_CORNER_RATIO_PROPERTY),
      );
    expect(named).toEqual([]);
    const shared = readFileSync(join(SRC_DIR, CONCENTRIC_CSS), 'utf8');
    expect(shared).not.toMatch(new RegExp(`${AVATAR_CORNER_RATIO_PROPERTY}\\s*:|@property`));
  });

  it('names the ratio property in no source but its publisher', () => {
    // An inline `style={{ '--avatar-corner-ratio': … }}` would re-scale one subtree's boxes
    // without their avatars.
    const named = sourceFiles(SRC_DIR)
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => file !== 'config/avatarShape.ts')
      .filter((file) => {
        const text = readFileSync(join(SRC_DIR, file), 'utf8');
        return (
          text.includes('--avatar-corner-ratio') || text.includes('AVATAR_CORNER_RATIO_PROPERTY')
        );
      });
    expect(named).toEqual([]);
  });

  it('reads whether a tile wears a frame only through wearsFrame', () => {
    const handWritten = sourceFiles(SRC_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/\bdata-(?:framed|tile-border)=\{([^}]*)\}/g)]
          .map(([, expression]) => expression ?? '')
          .filter((expression) => !/\bwearsFrame\(/.test(expression) || /frameId/.test(expression))
          .map((expression) => `${relative(SRC_DIR, file)}: {${expression.trim()}}`),
      );
    expect(handWritten).toEqual([]);
  });

  it('derives concentric corners from the published ratio alone', () => {
    const shared = rules(readFileSync(join(SRC_DIR, CONCENTRIC_CSS), 'utf8'));
    expect(shared.map(({ selector }) => selector)).toEqual([`.${AVATAR_CONCENTRIC_CLASS}`]);
    const radius = /border-radius\s*:([^;]*);/.exec(shared[0]?.body ?? '')?.[1] ?? '';
    expect(radius).toContain(`var(${AVATAR_CORNER_RATIO_PROPERTY})`);
    expect(radius).toContain('var(--avatar-inset');
    // Only the formula's own constants: no second copy of the ratio, no fixed corner.
    expect(radius.match(/\d+(?:\.\d+)?(?:px|%)?/g)).toEqual(['100%', '1', '2', '0px']);
    const root = document.createElement('div');
    applyAvatarShapeTokens(root);
    expect(root.style.getPropertyValue(AVATAR_CORNER_RATIO_PROPERTY)).toBe(
      String(AVATAR_CORNER_RATIO),
    );
    expect(readFileSync(join(SRC_DIR, 'main.tsx'), 'utf8')).toMatch(
      /applyAvatarShapeTokens\(document\.documentElement\)/,
    );
  });

  it('is a rounded square, not a circle or a sharp square', () => {
    expect(AVATAR_CORNER_RATIO).toBeGreaterThan(0);
    expect(AVATAR_CORNER_RATIO).toBeLessThan(0.5);
  });

  it('keeps the shape out of the avatar stylesheet', () => {
    // Avatar sets its corners inline from AVATAR_CORNER_RATIO; a stylesheet radius would be a
    // second source that the inline value silently wins over.
    const css = readFileSync(join(SRC_DIR, AVATAR_CSS), 'utf8');
    const avatarRules = rules(css).filter(({ selector }) =>
      selector.split(',').some((part) => TARGETS_AVATAR.test(part.trim())),
    );
    expect(avatarRules.length).toBeGreaterThan(0);
    expect(AVATAR_OWN_CLASSES).toEqual(expect.arrayContaining(['avatar', 'avatar-fallback']));
    expect(avatarRules.filter(({ body }) => SHAPE_PROPERTY.test(body))).toEqual([]);
  });
});

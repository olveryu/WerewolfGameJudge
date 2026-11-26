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
 * called. A census parses every TSX file and records, for each `<Avatar>` and `<ResidentAvatarTile>`
 * (and each component that returns one bare), the element it sits in; adding a site or wrapping one
 * in a new element changes the census and fails it, and every classed wrapper must be a registered
 * host or concentric box, so the stylesheet checks below reach it.
 * Avatar artwork reaches the page only through `<Avatar>`: no bare `<img>` of a portrait or an
 * uploaded avatar URL. Files hosting an `<Avatar>` set no inline corner, clip or overflow either.
 *
 * A square box around an avatar (a seat, a tile, a mat, an avatar-sized placeholder) is
 * concentric with it: it carries `AVATAR_CONCENTRIC_CLASS`, whose one rule derives its corners
 * from the published ratio and the box's own `--avatar-inset`, and sets no radius of its own.
 * Every host names the box drawn around its avatar; a host that is not itself such a box, and the entrance stages between a box and
 * its avatar, set no corners at all. The ratio is declared nowhere in CSS (it is published from
 * `config/avatarShape.ts`), and a box reads whether its tile wears a frame only via `wearsFrame`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

import { AVATAR_CONCENTRIC_CLASS } from '@/components/avatar/avatarConcentric';
import {
  applyAvatarShapeTokens,
  AVATAR_CORNER_RATIO,
  AVATAR_CORNER_RATIO_PROPERTY,
} from '@/config/avatarShape';

const SRC_DIR = join(import.meta.dirname, '..');
const AVATAR_CSS = 'components/avatar/Avatar.css';
const CONCENTRIC_CSS = 'components/avatar/avatarConcentric.css';

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
 * placeholders that stand where an avatar would.
 */
const CONCENTRIC_BOXES: Readonly<Record<string, string>> = {
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
 * The census: per file, each avatar site as `<Carrier> in <wrapper>`. The wrapper is the nearest
 * enclosing element (its static classes, or `<Tag>` for an unclassed element or a component), or
 * `returned by <Fn>` when the function returns the site bare; a returning component is a carrier
 * too, so its own sites are listed where it is rendered.
 */
const AVATAR_SITES: Readonly<Record<string, readonly string[]>> = {
  // `account-entry`: AccountAvatar's own link/button classes come from its callers' props.
  'components/avatar/AccountAvatar.tsx': ['Avatar in returned by AccountAvatar'],
  'features/auth/LoginDialog.tsx': ['Avatar in login-strip-portrait'],
  'features/product/components/ResidentPreview.tsx': ['Avatar in resident-tile-avatar'],
  'features/room/components/PlayerProfileCard.tsx': [
    'ResidentAvatarTile in profile-avatar',
    'ResidentAvatarTile in profile-avatar',
  ],
  // Placed in the slot's `profile-equip-preview` box.
  'features/room/components/ProfileEquipmentShowcase.tsx': ['Avatar in returned by avatarSlot'],
  'features/room/components/RoomSeatTile.tsx': ['Avatar in seat-avatar'],
  'features/room/components/RoomShell.tsx': ['AccountAvatar in <button>'],
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
    'Avatar in <PickerCell>',
    'Avatar in <PickerCell>',
    'Avatar in <span>',
    'ResidentAvatarTile in <PickerCell>',
  ],
  // Both land in RewardPreview's `reward-preview` box.
  'routes/gacha/components/RewardPreview.tsx': [
    'ResidentAvatarTile in returned by (anonymous)',
    'Avatar in returned by (anonymous)',
  ],
  'routes/home/HomePage.tsx': ['AccountAvatar in <Link>'],
  'routes/settings/SettingsPage.tsx': [
    'Avatar in settings-teaser-item',
    'ResidentAvatarTile in settings-avatar',
  ],
  'routes/unlocks/UnlocksPage.tsx': [
    'Avatar in unlocks-thumb',
    'ResidentAvatarTile in returned by UnlockThumb',
    'UnlockThumb in unlocks-cell-frame',
  ],
};

/** The elements that carry an avatar into the page wherever they are rendered. */
const AVATAR_CARRIERS: readonly string[] = ['Avatar', 'ResidentAvatarTile'];

/** Role cards reuse the avatar art as role portraits; they are not user avatars. */
const ROLE_ART = /^games\/[\w-]+\/assets\/roleAvatars\.ts$/;
/** Avatar artwork, or an `avatarSources` export that turns an avatar into an image URL. */
const AVATAR_IMAGE_SOURCE =
  /assets\/avatars\/|\b(?:getHandDrawnPortraitUrl|resolveAvatarSource|HAND_DRAWN_PORTRAITS)\b/;

/** The `src` expression of every `<img>` in a TSX source (attributes may span lines). */
const IMG_SRC = /<img\b[^>]*?\bsrc=\{([^}]*)\}/g;
/** An inline style key that could cut or re-shape a hosted avatar. */
const INLINE_SHAPE =
  /\b(?:borderRadius|border\w*Radius|clipPath|WebkitClipPath|mask\w*|WebkitMask\w*|overflow[XY]?)\s*:/;
/** The body of every inline `style={{ … }}` object in a TSX source. */
const INLINE_STYLE = /\bstyle=\{\{([^}]*)\}\}/g;

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

/** Does this compound style the concentric box `.<name>` (not its non-concentric variant)? */
function styles(compound: string, name: string): boolean {
  if (compound.includes(`:not(.${AVATAR_CONCENTRIC_CLASS})`)) return false;
  return new RegExp(`\\.${name}(?![-\\w])`).test(compound);
}

/** `const` initializers by name, so a className held in a constant resolves to its classes. */
function constantsOf(source: ts.SourceFile): Map<string, ts.Expression> {
  const constants = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      constants.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return constants;
}

/** The static class names a className expression can produce (imported constants drop out). */
function classNamesOf(
  expression: ts.Node | undefined,
  constants: Map<string, ts.Expression>,
  seen: Set<string> = new Set(),
): string[] {
  if (expression === undefined) return [];
  const words = (text: string) => text.split(/\s+/).filter((word) => word !== '');
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return words(expression.text);
  }
  if (ts.isTemplateExpression(expression)) {
    return [
      ...words(expression.head.text),
      ...expression.templateSpans.flatMap((span) => [
        ...classNamesOf(span.expression, constants, seen),
        ...words(span.literal.text),
      ]),
    ];
  }
  if (ts.isIdentifier(expression)) {
    const value = constants.get(expression.text);
    if (value === undefined || seen.has(expression.text)) return [];
    seen.add(expression.text);
    return classNamesOf(value, constants, seen);
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...classNamesOf(expression.whenTrue, constants, seen),
      ...classNamesOf(expression.whenFalse, constants, seen),
    ];
  }
  if (ts.isParenthesizedExpression(expression) || ts.isJsxExpression(expression)) {
    return classNamesOf(expression.expression, constants, seen);
  }
  return [];
}

function openingOf(element: ts.JsxElement | ts.JsxSelfClosingElement) {
  return ts.isJsxElement(element) ? element.openingElement : element;
}

/** The element's (or component's) static classes, else `<Tag>`. */
function wrapperOf(element: ts.JsxElement, constants: Map<string, ts.Expression>): string {
  const opening = element.openingElement;
  const tag = opening.tagName.getText();
  const className = opening.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'className',
  );
  const classes = className && ts.isJsxAttribute(className) ? className.initializer : undefined;
  const names = [...new Set(classNamesOf(classes, constants))];
  return names.length === 0 ? `<${tag}>` : names.join(' ');
}

function functionName(fn: ts.SignatureDeclaration): string | undefined {
  if (fn.name !== undefined) return fn.name.getText();
  return ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText() : undefined;
}

/** Every avatar site per file, as `<Carrier> in <wrapper>` (see `AVATAR_SITES`). */
function avatarCensus(): Record<string, string[]> {
  const texts = sourceFiles(SRC_DIR)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  // Parse only files that render a carrier (parsing every TSX file is slow); parsed once each.
  const parsed = new Map<
    string,
    { source: ts.SourceFile; constants: Map<string, ts.Expression> }
  >();
  const parse = (file: string, text: string) => {
    let entry = parsed.get(file);
    if (entry === undefined) {
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      entry = { source, constants: constantsOf(source) };
      parsed.set(file, entry);
    }
    return entry;
  };
  const carriers = new Set(AVATAR_CARRIERS);
  for (;;) {
    const census: Record<string, string[]> = {};
    const before = carriers.size;
    const renders = new RegExp(`<(?:${[...carriers].join('|')})(?![\\w.])`);
    for (const { file: path, text } of texts.filter(({ text }) => renders.test(text))) {
      const file = relative(SRC_DIR, path);
      const { source, constants } = parse(path, text);
      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
          carriers.has(openingOf(node).tagName.getText())
        ) {
          let parent: ts.Node | undefined = node.parent;
          while (parent !== undefined && !ts.isJsxElement(parent) && !ts.isFunctionLike(parent)) {
            parent = parent.parent;
          }
          let wrapper = '<root>';
          if (parent !== undefined && ts.isJsxElement(parent)) {
            wrapper = wrapperOf(parent, constants);
          } else if (parent !== undefined) {
            const name = functionName(parent);
            wrapper = `returned by ${name ?? '(anonymous)'}`;
            if (name !== undefined && /^[A-Z]/.test(name)) carriers.add(name);
          }
          (census[file] ??= []).push(`${openingOf(node).tagName.getText()} in ${wrapper}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    if (carriers.size === before) return census;
  }
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

  it('has every site registered with the element it sits in', () => {
    const census = avatarCensus();
    expect(census).toEqual(AVATAR_SITES);
    // A classed wrapper is a host or a concentric box, so the stylesheet checks reach it.
    const registered = new Set([...AVATAR_HOSTS, ...Object.keys(CONCENTRIC_BOXES)]);
    const unregistered = Object.values(census)
      .flat()
      .map((site) => site.replace(/^\S+ in /, ''))
      .filter((wrapper) => !wrapper.startsWith('<') && !wrapper.startsWith('returned by '))
      .filter((wrapper) => !wrapper.split(' ').some((name) => registered.has(name)));
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
        [...readFileSync(join(SRC_DIR, file), 'utf8').matchAll(IMG_SRC)]
          .map(([, src]) => src ?? '')
          .filter((src) => /avatarurl/i.test(src))
          .map((src) => `${file}: src={${src.trim()}}`),
      );
    expect(bareImages).toEqual([]);
  });

  it('is not re-shaped by inline styles where it is hosted or boxed', () => {
    const files = new Set([...Object.keys(AVATAR_SITES), ...Object.values(CONCENTRIC_BOXES)]);
    const inlineShapes = [...files].flatMap((file) =>
      [...readFileSync(join(SRC_DIR, file), 'utf8').matchAll(INLINE_STYLE)]
        .map(([, body]) => body ?? '')
        .filter((body) => INLINE_SHAPE.test(body))
        .map((body) => `${file}: style={{${body.trim()}}}`),
    );
    expect(inlineShapes).toEqual([]);
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

  it('lets no concentric box set its own corners, and has each set its inset', () => {
    const sheets = otherCssFiles().map((file) => ({
      file: relative(SRC_DIR, file),
      rules: rules(readFileSync(file, 'utf8')),
    }));
    const ownRadius: string[] = [];
    const withoutInset: string[] = [];
    for (const box of Object.keys(CONCENTRIC_BOXES)) {
      let setsInset = false;
      for (const { file, rules: sheetRules } of sheets) {
        for (const { selector, body } of sheetRules) {
          const subjects = selector.split(',').map((part) => subjectOf(part));
          if (!subjects.some((subject) => styles(subject, box))) continue;
          if (RADIUS.test(body)) ownRadius.push(`${file}: ${selector}`);
          if (/^\s*--avatar-inset\s*:/m.test(body)) setsInset = true;
        }
      }
      if (!setsInset) withoutInset.push(box);
    }
    expect(ownRadius).toEqual([]);
    expect(withoutInset).toEqual([]);
  });

  it('gives hosts that are not boxes, and the stages inside a box, no corners', () => {
    const wrappers = [
      ...AVATAR_HOSTS.filter((host) => !(host in CONCENTRIC_BOXES)),
      ...AVATAR_STAGES,
    ];
    const cornered = otherCssFiles().flatMap((file) =>
      rules(readFileSync(file, 'utf8'))
        .filter(
          ({ selector, body }) =>
            RADIUS.test(body) &&
            selector
              .split(',')
              .some((part) => wrappers.some((name) => styles(subjectOf(part), name))),
        )
        .map(({ selector }) => `${relative(SRC_DIR, file)}: ${selector}`),
    );
    expect(cornered).toEqual([]);
  });

  it('declares the ratio in no stylesheet', () => {
    const declared = cssFiles(SRC_DIR)
      .filter((file) =>
        new RegExp(`${AVATAR_CORNER_RATIO_PROPERTY}\\s*:`).test(readFileSync(file, 'utf8')),
      )
      .map((file) => relative(SRC_DIR, file));
    expect(declared).toEqual([]);
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
    expect(avatarRules.filter(({ body }) => SHAPE_PROPERTY.test(body))).toEqual([]);
  });
});

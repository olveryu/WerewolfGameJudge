/**
 * Contract test: one avatar shape.
 *
 * `Avatar` owns its corners (`AVATAR_CORNER_RATIO`, at every size; `Avatar.test.tsx` pins the
 * value) and the scene draws avatar frames along the same corner.
 *
 * Stylesheets are parsed with PostCSS and selectors with `postcss-selector-parser`: nested rules
 * resolve against their parents, `@scope` prefixes its root, other at-rules are transparent, a part
 * is read once per argument of each `:is()`/`:where()`, class names are unescaped, `[class~=x]`
 * reads as `.x`, vendor prefixes are dropped, `all` counts as a shape property, and a selector's
 * rules are merged. With that reading:
 * - no rule whose subject is the avatar element by its own classes (`avatar`, `avatar-fallback`,
 *   read from `Avatar.tsx`) sets a corner, clip-path or mask, in any stylesheet;
 * - no rule whose subject could be the avatar by its tag (`img`, `span`, `*` or none, with no class
 *   but the avatar's own) shapes it, whatever it is scoped in, except the rules in
 *   `NOT_AN_AVATAR`; nor does any rule on an element inside an avatar;
 * - no avatar wrapper (an `*avatar*` class with `overflow: hidden|clip` plus a radius, or any
 *   clip-path/mask) clips it, and no host cuts it.
 *
 * Every element that hosts an `<Avatar>` is registered in `AVATAR_HOSTS`, whatever its class is
 * called. A census parses the source files that name a carrier (`<Avatar>`, `<ResidentAvatarTile>`,
 * aliases, components returning one) and records the elements from each site out to its box;
 * adding a site or wrapping one in a new element changes it and fails, and each class on the way
 * must be a registered host, stage or box, so the stylesheet checks reach it. A class the census
 * cannot read fails too; what it can and cannot follow is listed in `avatarCensus.ts`. Where a
 * held site finally lands is stated beside its entry.
 *
 * Sources are read with one TypeScript program over `src`, so a name resolves to its declaration
 * by scope and through imports. No native element draws an avatar URL: an image-bearing attribute
 * (`src`, `srcSet`, `href`, `style`, …) whose value reaches one fails. A file hosting an avatar or
 * drawing a box sets no inline corner, clip, mask or overflow: a `style` is followed through
 * conditionals, spreads, names and calls into the app files declaring them, and a value it
 * cannot follow fails. From script, only the seat entrance's wipe (`style.clipPath`) and the
 * ratio's publisher set a shaping style; style writes, `cssText`, `setProperty`,
 * `Object.assign(….style)`, `setAttribute('style')` and literal `.animate()` keyframes are read.
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
 * Not checked: an element outside the box (or outside a host with no box) that clips everything
 * in it, such as a seat's own wrapper; an element of its own drawn over an avatar inside its host
 * (an overlay or a badge is not told apart by its class); a selector reaching a host or box by
 * tag or by an attribute other than `class`; a `style` or image URL passed in as a prop from
 * another component; keyframes passed to `.animate()` through a name; and a wrong
 * `--avatar-inset` value.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import postcss, { type Container, list } from 'postcss';
import selectorParser from 'postcss-selector-parser';
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

/** A declaration of one of `properties` in a rule body, on its own line or after a `;`. */
const declares = (properties: string, value = '') =>
  new RegExp(`(?:^|;)\\s*(?:${properties})\\s*:${value}`, 'm');
const RADIUS_PROPERTY = 'border(?:-[a-z]+)*-radius|corner-shape|all';
const CLIP_PROPERTY = 'clip-path|mask(?:-[a-z]+)*';
const SHAPE_PROPERTY = declares(`${RADIUS_PROPERTY}|${CLIP_PROPERTY}`);
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
  'toolbox-room-avatar',
  'ui-gallery-avatars',
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
  'toolbox-room-avatar': null,
  // The gallery lays its fixed-seed avatars out bare in a row.
  'ui-gallery-avatars': null,
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
  'games/toolbox/room/ToolboxRoomScreen.tsx': ['ResidentAvatarTile in toolbox-room-avatar'],
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
  'routes/bench/UiGallery.tsx': ['Avatar in ui-gallery-avatars'],
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
/** Native attributes that can put an image on the page. */
const IMAGE_ATTRIBUTES = /^(?:src|srcset|href|xlink:href|xlinkhref|poster|style|background)$/i;

/**
 * Rules whose subject could be the avatar by its tag alone but which style other elements, with
 * why: none of them is inside an avatar's host.
 */
const NOT_AN_AVATAR: Readonly<Record<string, string>> = {
  'features/room/components/RoomShareDialog.css: .room-share-qr-logo img': 'the QR code logo',
  'routes/admin/admin.css: .admin-badge > span': 'a status badge dot',
  'routes/admin/admin.css: .admin-skeleton span': 'a loading placeholder bar',
  'routes/settings/MusicSettingsPage.css: .music-equalizer span': 'an equalizer bar',
  'routes/settings/SettingsPage.css: .segmented-option span': 'a segmented control label',
};

let program: { readonly program: ts.Program; readonly checker: ts.TypeChecker } | undefined;

/**
 * One TypeScript program over the app's sources (nothing outside `src` is loaded), so a name
 * resolves to its own declaration, across files through imports, by scope.
 */
function appProgram(): { readonly program: ts.Program; readonly checker: ts.TypeChecker } {
  if (program !== undefined) return program;
  const options: ts.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    paths: { '@/*': [`${SRC_DIR}/*`] },
    noEmit: true,
    noLib: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const inApp = (fileName: string) => fileName.startsWith(SRC_DIR);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.getSourceFile = (fileName, ...rest) =>
    inApp(fileName) ? getSourceFile(fileName, ...rest) : undefined;
  host.fileExists = (fileName) => inApp(fileName) && fileExists(fileName);
  const built = ts.createProgram(sourceFiles(SRC_DIR), options, host);
  program = { program: built, checker: built.getTypeChecker() };
  return program;
}

/** The app declarations a name resolves to (through import aliases); none for a package name. */
function declarationsOf(identifier: ts.Identifier): ts.Declaration[] {
  const { checker } = appProgram();
  let symbol = checker.getSymbolAtLocation(identifier);
  if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  return (symbol?.declarations ?? []).filter(
    (declaration) =>
      declaration.getSourceFile().fileName.startsWith(SRC_DIR) &&
      !ts.isImportSpecifier(declaration),
  );
}

/** Is this identifier a name being read (not a property name or an object key)? */
function isRead(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) return false;
  if (
    (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) &&
    parent.name === identifier
  ) {
    return false;
  }
  return !(ts.isJsxAttribute(parent) || ts.isQualifiedName(parent));
}

/** The expressions a function may return (a concise arrow body, each `return`). */
function returnsOf(fn: ts.SignatureDeclaration): ts.Expression[] {
  if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && !ts.isBlock(fn.body)) {
    return [fn.body];
  }
  const returned: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isReturnStatement(node) && node.expression !== undefined) returned.push(node.expression);
    if (!ts.isFunctionLike(node)) ts.forEachChild(node, visit);
  };
  if ('body' in fn && fn.body !== undefined) ts.forEachChild(fn.body, visit);
  return returned;
}

/** The function a declaration names, if it is one (a function, or a `const` holding one). */
function functionOf(declaration: ts.Declaration): ts.SignatureDeclaration | undefined {
  if (ts.isFunctionDeclaration(declaration)) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
    const initializer = declaration.initializer;
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return initializer;
  }
  return undefined;
}

/**
 * What a value may be computed from: the expression, and for each name it reads, that name's app
 * declaration (a `const`'s initializer, the object a destructured name is taken from, what a
 * function returns, and, for a parameter of a callback such as `.map`, the receiver it is called
 * on), followed on. A parameter of a component (a prop) ends the trail.
 */
function reach(value: ts.Node): ts.Node[] {
  const reached: ts.Node[] = [];
  const seen = new Set<ts.Node>();
  const expand = (node: ts.Node) => {
    if (seen.has(node)) return;
    seen.add(node);
    reached.push(node);
    const visit = (child: ts.Node) => {
      if (ts.isIdentifier(child) && isRead(child)) {
        for (const declaration of declarationsOf(child)) {
          const fn = functionOf(declaration);
          if (fn !== undefined) {
            returnsOf(fn).forEach(expand);
          } else if (ts.isVariableDeclaration(declaration)) {
            if (declaration.initializer !== undefined) expand(declaration.initializer);
          } else if (ts.isBindingElement(declaration)) {
            let binding: ts.Node = declaration;
            while (
              ts.isBindingElement(binding) ||
              ts.isObjectBindingPattern(binding) ||
              ts.isArrayBindingPattern(binding)
            ) {
              binding = binding.parent;
            }
            if (ts.isVariableDeclaration(binding) && binding.initializer !== undefined) {
              expand(binding.initializer);
            }
            if (ts.isParameter(binding)) expandParameter(binding);
          } else if (ts.isParameter(declaration)) {
            expandParameter(declaration);
          }
        }
      }
      if (!ts.isFunctionLike(child) || child === node) ts.forEachChild(child, visit);
    };
    visit(node);
  };
  const expandParameter = (parameter: ts.ParameterDeclaration) => {
    const call = parameter.parent.parent;
    if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)) {
      expand(call.expression.expression);
    }
  };
  expand(value);
  return reached;
}

/**
 * The object literals a style value may be, through conditionals, logical operators, spreads,
 * names (by declaration, across files) and calls (by what the function returns); `?` for a value
 * that cannot be followed (a package, a property read, a call it cannot resolve). A prop is
 * not followed.
 */
function styleObjects(value: ts.Expression): (ts.ObjectLiteralExpression | '?')[] {
  const objects: (ts.ObjectLiteralExpression | '?')[] = [];
  const seen = new Set<ts.Node>();
  const walk = (node: ts.Expression) => {
    if (seen.has(node)) return;
    seen.add(node);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      walk(node.expression);
    } else if (ts.isConditionalExpression(node)) {
      walk(node.whenTrue);
      walk(node.whenFalse);
    } else if (ts.isBinaryExpression(node)) {
      walk(node.left);
      walk(node.right);
    } else if (ts.isObjectLiteralExpression(node)) {
      objects.push(node);
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) walk(property.expression);
      }
    } else if (ts.isIdentifier(node)) {
      if (node.text === 'undefined') return;
      const declarations = declarationsOf(node);
      if (declarations.length === 0) objects.push('?');
      for (const declaration of declarations) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
          walk(declaration.initializer);
        } else if (!ts.isParameter(declaration) && !ts.isBindingElement(declaration)) {
          objects.push('?');
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? declarationsOf(node.expression) : [];
      const fns = callee.map(functionOf).filter((fn) => fn !== undefined);
      if (fns.length === 0) objects.push('?');
      fns.flatMap(returnsOf).forEach(walk);
    } else if (!(
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.TrueKeyword
    )) {
      objects.push('?');
    }
  };
  walk(value);
  return objects;
}

/** A JSX attribute of a native element or component, with its value expression. */
interface JsxAttributeValue {
  readonly tag: string;
  readonly attribute: string;
  readonly value: ts.Expression;
}

/** Every JSX attribute `wanted(tag, attribute)` with an expression value in an app source file. */
function attributeValues(
  path: string,
  wanted: (tag: string, attribute: string) => boolean,
): JsxAttributeValue[] {
  const source = appProgram().program.getSourceFile(path);
  if (source === undefined) return [];
  const found: JsxAttributeValue[] = [];
  const collect = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property) || property.initializer === undefined) continue;
        const attribute = property.name.getText();
        const initializer = property.initializer;
        const value = ts.isJsxExpression(initializer) ? initializer.expression : initializer;
        if (value !== undefined && wanted(tag, attribute)) found.push({ tag, attribute, value });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  return found;
}

/** A style key, normalized (`border-radius`, `WebkitBorderRadius` → `borderradius`). */
const styleKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[-_]/g, '')
    .replace(/^webkit/, '');
/** A style key that could cut or re-shape a hosted avatar. */
const INLINE_SHAPE =
  /^(?:border\w*radius|clippath|mask\w*|overflow[xy]?|cornershape|avatarcornerratio|all)$/;
/** A style key that gives an element corners or a cut (`overflow` alone cuts no shape). */
const SCRIPT_SHAPE = /^(?:border\w*radius|clippath|mask\w*|cornershape|avatarcornerratio|all)$/;
/** A shaping declaration in CSS text (`cssText`, a `style` attribute string). */
const CSS_TEXT_SHAPE =
  /(?:^|[;{\s'"`])(?:-[a-z]+-)?(?:border(?:-[a-z]+)*-radius|corner-shape|clip-path|mask(?:-[a-z]+)*|all)\s*:/i;

/**
 * The property name an expression evaluates to, as far as it can be read: a string, a `const`
 * holding one, or a call to an app function returning one; a template counts by its leading
 * part when that names a custom property (`--color-${token}`, `${name}-a${percent}`).
 */
function propertyName(node: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    if (node.head.text.startsWith('--')) return node.head.text;
    const lead = node.templateSpans[0]?.expression;
    const name = node.head.text === '' && lead !== undefined ? propertyName(lead) : undefined;
    return name?.startsWith('--') ? name : undefined;
  }
  const names = (
    ts.isIdentifier(node)
      ? declarationsOf(node)
      : ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        ? declarationsOf(node.expression)
        : []
  )
    .flatMap((declaration) => {
      const fn = functionOf(declaration);
      if (fn !== undefined) return returnsOf(fn);
      return ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined
        ? [declaration.initializer]
        : [];
    })
    .map(propertyName);
  return names.length > 0 && names.every((name) => name !== undefined)
    ? names.join(' ')
    : undefined;
}

/**
 * Every place a source sets a shaping style from script: `.style.x =` or `.style['x'] =`,
 * `.style.cssText =` or `.style =` with CSS text, `.style.setProperty(…)`,
 * `Object.assign(….style, …)`, `.setAttribute('style', …)`, and literal keyframes passed to
 * `.animate(…)`. A key or text it cannot read is `?`.
 */
function scriptShapes(path: string): string[] {
  const source = appProgram().program.getSourceFile(path);
  if (source === undefined) return [];
  const found: string[] = [];
  const isStyle = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) && node.name.text === 'style';
  const text = (node: ts.Node | undefined, label: string) => {
    if (node === undefined || !(ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))) {
      found.push(`${label} ?`);
    } else if (CSS_TEXT_SHAPE.test(node.getText())) {
      found.push(label);
    }
  };
  const key = (name: string, label: string) => {
    if (name === '?' || SCRIPT_SHAPE.test(styleKey(name))) found.push(`${label}${name}`);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const left = node.left;
      if (isStyle(left)) text(node.right, 'style =');
      else if (ts.isPropertyAccessExpression(left) && isStyle(left.expression)) {
        if (left.name.text === 'cssText') text(node.right, 'style.cssText =');
        else key(left.name.text, 'style.');
      } else if (ts.isElementAccessExpression(left) && isStyle(left.expression)) {
        const argument = left.argumentExpression;
        key(ts.isStringLiteralLike(argument) ? argument.text : '?', 'style.');
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const [first, second] = node.arguments;
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        if (method === 'setProperty' && isStyle(callee.expression)) {
          key(first === undefined ? '?' : (propertyName(first) ?? '?'), 'style.');
        } else if (
          method === 'assign' &&
          callee.expression.getText() === 'Object' &&
          first !== undefined &&
          isStyle(first)
        ) {
          for (const source of node.arguments.slice(1)) {
            if (ts.isObjectLiteralExpression(source)) {
              styleKeys([source]).forEach((name) => key(name, 'Object.assign(style).'));
            } else {
              found.push('Object.assign(style) ?');
            }
          }
        } else if (
          method === 'setAttribute' &&
          first !== undefined &&
          ts.isStringLiteralLike(first) &&
          first.text.toLowerCase() === 'style'
        ) {
          text(second, "setAttribute('style')");
        } else if (
          method === 'animate' &&
          first !== undefined &&
          (ts.isArrayLiteralExpression(first) || ts.isObjectLiteralExpression(first))
        ) {
          styleKeys([first]).forEach((name) => key(name, 'animate().'));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The keys an object literal sets itself (`?` if computed); spreads are followed separately. */
function ownKeys(object: ts.ObjectLiteralExpression): string[] {
  return object.properties.flatMap((property) => {
    if (ts.isSpreadAssignment(property) || property.name === undefined) return [];
    const name = property.name;
    return ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name)
      ? [name.text]
      : ['?'];
  });
}

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

/** One compound of a selector, read by `postcss-selector-parser` (class names unescaped). */
interface Compound {
  /** Its tag, lowercased (`*` for the universal selector), if it names one. */
  readonly tag: string | undefined;
  /** Its classes, including `[class~=x]` and `[class=x]`. */
  readonly classes: readonly string[];
  /** The classes it excludes with a top-level `:not(.x)`. */
  readonly negated: readonly string[];
  /** Whether it selects a pseudo element (`::before`, `:after`, …). */
  readonly pseudoElement: boolean;
}

const LEGACY_PSEUDO_ELEMENTS = new Set([':before', ':after', ':first-line', ':first-letter']);
/** Pseudo classes matching any of their arguments; a part is read once per argument. */
const MATCHES_ANY = new Set([':is', ':where', ':matches', ':-webkit-any', ':-moz-any']);
const compoundCache = new Map<string, Compound[]>();

/** The compounds of a selector part, split at its combinators. */
function compoundsOf(part: string): Compound[] {
  const cached = compoundCache.get(part);
  if (cached !== undefined) return cached;
  const compounds: Compound[] = [];
  let tag: string | undefined;
  let classes: string[] = [];
  let negated: string[] = [];
  let pseudoElement = false;
  const flush = () => {
    compounds.push({ tag, classes, negated, pseudoElement });
    tag = undefined;
    classes = [];
    negated = [];
    pseudoElement = false;
  };
  selectorParser()
    .astSync(part)
    .first.each((node) => {
      if (node.type === 'combinator') {
        flush();
      } else if (node.type === 'tag') {
        tag = node.value.toLowerCase();
      } else if (node.type === 'universal') {
        tag = '*';
      } else if (node.type === 'class') {
        classes.push(node.value);
      } else if (node.type === 'attribute' && node.attribute.toLowerCase() === 'class') {
        const value = node.value ?? '';
        if (node.operator === '~=') classes.push(value);
        if (node.operator === '=')
          classes.push(...value.split(/\s+/).filter((name) => name !== ''));
      } else if (node.type === 'pseudo') {
        const name = node.value.toLowerCase();
        if (name.startsWith('::') || LEGACY_PSEUDO_ELEMENTS.has(name)) pseudoElement = true;
        const inner = node.nodes.length === 1 ? node.nodes[0]?.nodes : undefined;
        if (name === ':not' && inner?.length === 1 && inner[0]?.type === 'class') {
          negated.push(inner[0].value);
        }
      }
    });
  flush();
  compoundCache.set(part, compounds);
  return compounds;
}

/** A selector part read once per argument of each `:is()`/`:where()` in it. */
function expandMatchesAny(part: string): string[] {
  const any = selectorParser()
    .astSync(part)
    .first.nodes.find(
      (node) => node.type === 'pseudo' && MATCHES_ANY.has(node.value.toLowerCase()),
    );
  if (any === undefined || any.type !== 'pseudo') return [part];
  const at = part.indexOf(String(any).trim(), any.sourceIndex);
  if (at < 0) return [part];
  const length = String(any).trim().length;
  return any.nodes.flatMap((argument) =>
    expandMatchesAny(`${part.slice(0, at)}${String(argument).trim()}${part.slice(at + length)}`),
  );
}

/** The last compound of a selector part: the element the rule styles. */
function subjectOf(part: string): Compound {
  return (
    compoundsOf(part).at(-1) ?? { tag: undefined, classes: [], negated: [], pseudoElement: false }
  );
}

/** Tags the avatar element is drawn as (`*`, or none, match it too). */
const AVATAR_TAGS = new Set(['img', 'span', '*']);

/**
 * Could this compound match the avatar element: a tag it is drawn as (or none), no class but its
 * own root classes, and not a pseudo element?
 */
function mayBeAvatar(compound: Compound): boolean {
  return (
    !compound.pseudoElement &&
    (compound.tag === undefined || AVATAR_TAGS.has(compound.tag)) &&
    compound.classes.every((name) => AVATAR_SELF_CLASSES.includes(name))
  );
}

/** Does this compound name the avatar element by one of its root classes? */
const namesAvatarElement = (compound: Compound) =>
  compound.classes.some((name) => AVATAR_SELF_CLASSES.includes(name));

/** A selector part whose subject is the avatar element itself, by its class. */
const targetsAvatar = (part: string) => namesAvatarElement(subjectOf(part));

/** Any compound in the part names an avatar-ish class (`.seat-avatar`, `.room-user-avatar-clip`). */
const namesAvatar = (part: string) =>
  compoundsOf(part).some((compound) => compound.classes.some((name) => name.includes('avatar')));

/**
 * Does a rule with this subject give it corners or a cut of its own? A pseudo element may take
 * its element's corners (`inherit`); the element itself may not take its parent's.
 */
const shapes = (subject: Compound, body: string) =>
  (subject.pseudoElement ? OWN_SHAPE : SHAPE_PROPERTY).test(body);

function hostIn(part: string): string | undefined {
  return AVATAR_HOSTS.find((host) =>
    compoundsOf(part).some((compound) => compound.classes.includes(host)),
  );
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
 * transparent. Each selector part is read once per argument of an `:is()`/`:where()` in it.
 * Properties are lowercased with any vendor prefix dropped. Rules repeating a selector are merged,
 * so a split declaration is judged as one rule.
 */
function rules(source: string): CssRule[] {
  const merged = new Map<string, { parts: string[]; body: string }>();
  const walk = (container: Container, parents: string[] | undefined) => {
    const declarations: string[] = [];
    container.each((node) => {
      if (node.type === 'decl') {
        declarations.push(`${node.prop.toLowerCase().replace(/^-[a-z]+-/, '')}: ${node.value};`);
      } else if (node.type === 'rule') {
        walk(node, nest(parents, node.selectors));
      } else if (node.type === 'atrule' && node.nodes !== undefined) {
        const root =
          node.name.toLowerCase() === 'scope' ? /^\s*\(([^)]*)\)/.exec(node.params) : null;
        walk(node, root?.[1] === undefined ? parents : nest(parents, list.comma(root[1])));
      }
    });
    if (parents === undefined || declarations.length === 0) return;
    const parts = parents
      .map((part) => part.replaceAll(':scope', '').trim() || ':scope')
      .flatMap(expandMatchesAny);
    const selector = parts.join(', ');
    const entry = merged.get(selector) ?? { parts, body: '' };
    merged.set(selector, { parts, body: `${entry.body}\n${declarations.join('\n')}` });
  };
  walk(postcss.parse(source), undefined);
  return [...merged].map(([selector, { parts, body }]) => ({ selector, parts, body }));
}

/** The class lists `Avatar` gives its own elements, read from its source. */
const AVATAR_CLASS_LISTS = [
  ...readFileSync(join(SRC_DIR, 'components/avatar/Avatar.tsx'), 'utf8').matchAll(
    /className="([^"]*)"/g,
  ),
].map(([, names]) => (names ?? '').split(/\s+/).filter((name) => name !== ''));
/** Every class on `Avatar`'s own elements. */
const AVATAR_OWN_CLASSES = AVATAR_CLASS_LISTS.flat();
/** The classes on the avatar element itself (the lists with `avatar`; `avatar-fallback` too). */
const AVATAR_SELF_CLASSES = AVATAR_CLASS_LISTS.filter((names) => names.includes('avatar')).flat();

/** Does this compound select only through the avatar's own classes (and attributes, states)? */
function ownAvatarCompound(compound: Compound): boolean {
  return (
    compound.tag === undefined &&
    compound.negated.length === 0 &&
    compound.classes.length > 0 &&
    compound.classes.every((name) => AVATAR_OWN_CLASSES.includes(name))
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

/** Does this compound style `.<name>` (and, for a box, not its non-concentric variant)? */
function styles(compound: Compound, name: string): boolean {
  return compound.classes.includes(name) && !compound.negated.includes(AVATAR_CONCENTRIC_CLASS);
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

// One TypeScript program over every source file is built once and walked by several checks; on a
// loaded CI runner that takes longer than the default per-test timeout.
describe('Avatar shape', { timeout: 60_000 }, () => {
  beforeAll(() => {
    appProgram();
  }, 60_000);

  it('is set by Avatar alone', () => {
    const overrides = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules
        .filter(
          ({ parts, body }) =>
            parts.some((part) => targetsAvatar(part)) && SHAPE_PROPERTY.test(body),
        )
        .map(({ selector }) => `${file}: ${selector}`),
    );
    expect(overrides).toEqual([]);
  });

  it('is not re-shaped by a rule that could select it without a class', () => {
    // The avatar is an `<img>` or a `<span>`: a rule whose subject could be it (that tag, `*` or
    // none, with no class but the avatar's own) may not shape it, whatever it is scoped in; nor
    // may a rule on an element inside an avatar. Rules known to style other elements are listed.
    const reaching = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules.flatMap(({ parts, body }) =>
        parts
          .filter((part) => {
            const compounds = compoundsOf(part);
            const subject = subjectOf(part);
            const inAvatar = compounds.slice(0, -1).some(namesAvatarElement);
            return (inAvatar || mayBeAvatar(subject)) && shapes(subject, body);
          })
          .map((part) => `${file}: ${part.trim()}`),
      ),
    );
    expect(reaching.filter((rule) => !(rule in NOT_AN_AVATAR))).toEqual([]);
    expect(Object.keys(NOT_AN_AVATAR).filter((rule) => !reaching.includes(rule))).toEqual([]);
  });

  it('is not cut by an avatar wrapper', () => {
    const clippers = sheets().flatMap(({ file, rules: sheetRules }) =>
      sheetRules
        .filter(
          ({ parts, body }) =>
            parts.some(namesAvatar) &&
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
            if (subject.classes.includes(host))
              return CLIPS_CONTENT.test(body) && RADIUS.test(body);
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

  it('is never drawn as a native element of an avatar URL', () => {
    // Any image-bearing attribute of a native element (`<img src|srcSet>`, `<image href>`, a
    // `style` with a background image, …) whose value reaches an avatar URL.
    const drawn = sourceFiles(SRC_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => relative(SRC_DIR, file))
      .filter((file) => !file.startsWith('components/avatar/'))
      .flatMap((file) =>
        attributeValues(
          join(SRC_DIR, file),
          (tag, attribute) => /^[a-z]/.test(tag) && IMAGE_ATTRIBUTES.test(attribute),
        )
          .filter(({ value }) => reach(value).some((node) => /avatarurl/i.test(node.getText())))
          .map(
            ({ tag, attribute, value }) => `${file}: <${tag} ${attribute}={${value.getText()}}>`,
          ),
      );
    expect(drawn).toEqual([]);
  });

  it('is not re-shaped by inline styles where it is hosted or boxed', () => {
    // A style is followed through names and calls into the app files that declare them; a value
    // that cannot be followed is `?` and fails.
    const files = new Set([...Object.keys(AVATAR_SITES), ...Object.values(CONCENTRIC_BOXES)]);
    const inlineShapes = [...files].flatMap((file) =>
      attributeValues(join(SRC_DIR, file), (_, attribute) => attribute === 'style').flatMap(
        ({ value }) =>
          styleObjects(value)
            .flatMap((object) => (object === '?' ? ['?'] : ownKeys(object)))
            .filter((key) => key === '?' || INLINE_SHAPE.test(styleKey(key)))
            .map((key) => `${file}: style={${value.getText()}} sets ${key}`),
      ),
    );
    expect(inlineShapes).toEqual([]);
  });

  it('is not re-shaped from script but by the seat entrance', () => {
    // The seat entrance wipes the avatar in with an inset clip while it plays; nothing else sets a
    // corner, clip or mask on an element from script.
    const imperative = sourceFiles(SRC_DIR).flatMap((file) =>
      scriptShapes(file).map((write) => `${relative(SRC_DIR, file)}: ${write}`),
    );
    // `config/avatarShape.ts` publishes the ratio itself.
    expect(imperative).toEqual([
      'config/avatarShape.ts: style.--avatar-corner-ratio',
      'scene/SeatEntrance.tsx: style.clipPath',
    ]);
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
    const avatarRules = rules(css).filter(({ parts }) => parts.some(targetsAvatar));
    expect(avatarRules.length).toBeGreaterThan(0);
    expect(AVATAR_SELF_CLASSES).toEqual(['avatar', 'avatar', 'avatar', 'avatar-fallback']);
    expect(avatarRules.filter(({ body }) => SHAPE_PROPERTY.test(body))).toEqual([]);
  });
});

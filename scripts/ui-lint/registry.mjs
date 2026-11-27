/**
 * The UI gate's registry: everything the gate allows, in one file (UI drift lock plan v3, §2–§4).
 *
 * The gate is an allow list. A CSS property, function, keyword, element, page element or DOM
 * member that is not registered here is reported, so a new API or a new spelling is rejected
 * without changing a rule. Every change to what the gate allows is a change to this file, visible
 * in the diff; `registry.test.mjs` pins the exemptions (`TOKEN_SHEET`, `ART_SHEETS`) and the DOM
 * writers exactly.
 */

// ---------------------------------------------------------------------------------------------
// Pages and the bundle graph (§3)
// ---------------------------------------------------------------------------------------------

/** The Vite root; every page under it (tracked by git) is an entry. */
export const WEB_ROOT = 'packages/web';

/** Entries a Vite plugin adds to the build besides the pages (checked against the plugin). */
export const BUILD_ENTRIES = Object.freeze(['packages/web/src/boot/bootSplash.ts']);

/**
 * The Vite plugins of `vite.config.ts`, by factory name, and what each adds to the module graph
 * the gate checks (P1 QA7/QA8 N2): a new plugin, or one that adds entries, changes this list.
 */
export const VITE_PLUGINS = Object.freeze({
  react: 'transforms JSX and Fast Refresh; adds no modules',
  babel: 'React Compiler transform; adds no modules',
  Icons: 'serves the `~icons/*` virtual modules (VIRTUAL_MODULES)',
  bootSplash: 'adds the boot splash entry (BUILD_ENTRIES)',
});

/** Elements and attributes a page may hold; a page has no inline style, script or handler. */
export const PAGE_ELEMENTS = Object.freeze(
  new Set([
    'html',
    'head',
    'meta',
    'title',
    'link',
    'body',
    'script',
    'div',
    'img',
    'span',
    'h1',
    'p',
    'a',
  ]),
);
export const PAGE_ATTRIBUTES = Object.freeze(
  new Set([
    'lang',
    'charset',
    'name',
    'content',
    'property',
    'http-equiv',
    'rel',
    'type',
    'sizes',
    'href',
    'src',
    'id',
    'class',
    'alt',
    'fetchpriority',
    'role',
    'hidden',
    'aria-label',
    'aria-live',
    'aria-valuemin',
    'aria-valuemax',
  ]),
);
/** `<link rel>` values a page may use; `stylesheet` must point at a local `.css` file. */
export const PAGE_LINK_RELS = Object.freeze(
  new Set(['icon', 'apple-touch-icon', 'manifest', 'stylesheet']),
);
export const PAGE_HTTP_EQUIV = Object.freeze(new Set(['content-security-policy']));
/**
 * `<meta name>` and `<meta property>` a page may hold (P1 QA12 nit 7). Their content is text the
 * browser or a link preview shows, except `theme-color`, a color: it must be the value of the
 * named entry of `colors` in `PALETTE`, since a meta element cannot read `var()`.
 */
export const PALETTE = 'packages/web/src/theme/colors.ts';
export const PAGE_META_NAMES = Object.freeze({
  viewport: null,
  description: null,
  'format-detection': null,
  'theme-color': 'surface',
});
export const PAGE_META_PROPERTIES = Object.freeze(
  new Set([
    'og:type',
    'og:title',
    'og:description',
    'og:image',
    'og:url',
    'og:locale',
    'og:site_name',
  ]),
);

/** File types a module may import as an asset (only the `?url` query is allowed). */
export const ASSET_EXTENSIONS = Object.freeze(
  new Set(['png', 'webp', 'svg', 'json', 'mp3', 'm4a']),
);
export const ASSET_QUERIES = Object.freeze(new Set(['', '?url']));
/**
 * The virtual modules a Vite plugin serves, by specifier prefix, each with the package that
 * holds them and its manifest field. Icons serves `~icons/<collection>/<name>` from that
 * collection's package and inlines its SVG past the value check, so only a collection drawn in
 * `currentColor` is registered (P1 QA14 F7): any other `~icons/` collection, and any icon
 * collection package in the web manifest that is not registered here, is a graph problem.
 */
export const VIRTUAL_MODULES = Object.freeze({
  '~icons/ion/': {
    package: '@iconify-json/ion',
    field: 'devDependencies',
    why: 'Ionicons, single-colour outline glyphs drawn in currentColor',
  },
});
/** Specifiers the Icons plugin answers, registered or not. */
export const VIRTUAL_MODULE_FAMILY = '~icons/';
/** Manifest packages that are icon collections the Icons plugin can serve. */
export const ICON_COLLECTION_PACKAGE = /^@iconify-json\/|^@iconify\/json$/;

/**
 * Third-party packages the bundle may import (by script entry; package stylesheets never), each
 * with the manifest field it must be declared in and what it brings to the page. A package the
 * web manifest declares in `dependencies` and does not register here, or a registered package
 * the manifest does not declare in that field, is a graph problem. A package with `entries`
 * may be imported only by those specifiers; an entry listed in `importers` only by those modules
 * (a type-only import loads nothing and is not one).
 */
export const PACKAGES = Object.freeze({
  // Ark's parts that open a dismissable layer are imported only by the shared module that owns
  // them: zag closes every layer above one that is removed, and only the owner handles that.
  // The package root (`@ark-ui/react`, which re-exports every part) is not an entry, so a static,
  // dynamic (`import('@ark-ui/react').then((m) => m.Dialog)`) or re-exported import of it is
  // rejected; an alias or a relative path into the package imports a file from a package and is
  // rejected by the graph (#524 QA11 M1).
  '@ark-ui/react': {
    field: 'dependencies',
    why: 'headless components; styles come from us',
    entries: [
      '@ark-ui/react/color-picker',
      '@ark-ui/react/dialog',
      '@ark-ui/react/portal',
      '@ark-ui/react/qr-code',
      '@ark-ui/react/tabs',
    ],
    importers: {
      '@ark-ui/react/color-picker': [
        'packages/web/src/features/drawing/components/DrawingToolbar.tsx',
      ],
      // zag closes every layer above a removed one; AppDialog's root blocks that cascade, so it
      // is Ark's one dialog root (#524).
      '@ark-ui/react/dialog': ['packages/web/src/components/AppDialog.tsx'],
    },
  },
  '@sentry/react': { field: 'dependencies', why: 'error reporting; renders no UI' },
  '@tanstack/react-query': { field: 'dependencies', why: 'data fetching; renders no UI' },
  '@zumer/snapdom': { field: 'dependencies', why: 'screenshot capture of our own DOM' },
  'pinyin-pro': { field: 'dependencies', why: 'text conversion; renders no UI' },
  'pixi.js': { field: 'dependencies', why: 'canvas renderer (D13: its own style writes)' },
  // `entries`: the only specifiers of the package the bundle may import. React DOM's resource
  // APIs (`preinit`, `preload`) insert <link>/<script> past the gate, and JSX goes through the
  // compiler, not `react/jsx-runtime` (E11).
  react: { field: 'dependencies', why: 'UI runtime', entries: ['react'] },
  'react-dom': { field: 'dependencies', why: 'createRoot only', entries: ['react-dom/client'] },
  'react-router': { field: 'dependencies', why: 'routing; renders no UI' },
  sonner: { field: 'dependencies', why: 'toasts (D13: injects its own <style>)' },
  zod: { field: 'dependencies', why: 'validation; renders no UI' },
  msw: { field: 'devDependencies', why: 'admin mock worker, started only in the admin-mock mode' },
});

// ---------------------------------------------------------------------------------------------
// CSS (§2 S1, S2, S4, S7, S10)
// ---------------------------------------------------------------------------------------------

/** The token stylesheet: only custom property definitions, under these selectors. */
export const TOKEN_SHEET = Object.freeze({
  file: 'packages/web/src/theme/tokens.css',
  selectors: Object.freeze(['.admin-console', ':root']),
});

/** Token families `colors.ts` publishes at runtime; no stylesheet defines a name in them. */
export const RUNTIME_TOKEN_FAMILIES = Object.freeze(['--color-', '--report-']);

/** The module that publishes `RUNTIME_TOKEN_FAMILIES`: its `setProperty` writes are the tokens. */
export const TOKEN_PUBLISHER = 'packages/web/src/theme/colors.ts';
/**
 * Token constants a TSX write site may name directly (E4, D15 ②, plan v3.12): `module#export`
 * (module as a repo path without extension) → the value domain every member of the export
 * belongs to. A static member path below the import passes where that domain, or a custom
 * property, is written. Empty: the app has no token constant module yet; one is registered
 * here with the sheet that defines its values.
 */
export const TOKEN_CONSTANTS = Object.freeze(new Map());

/**
 * Runtime sources (E4, D15 ②, plan v3.12): `module#export` of the wrapper a computed value is
 * written through (`style={{ '--x': runtimeStyle(v) }}`, read by a stylesheet's `var(--x)`).
 * The one channel for a runtime value is a custom property, so a wrapped value passes only
 * there. Empty: no wrapper exists yet, so every runtime value is reported and the existing ones
 * are in the baseline.
 */
export const RUNTIME_SOURCES = Object.freeze(new Set());

/** Keyframe members that are not CSS properties (`Element.animate`, Web Animations). */
export const KEYFRAME_META = Object.freeze(
  new Map([
    // A keyframe's position is a fraction of the run: a count, no length.
    ['offset', 'free'],
    ['easing', 'motion'],
    ['composite', 'motion'],
  ]),
);

/**
 * `animate` timing options and the animation property whose domain judges each (a duration or
 * delay is milliseconds, written as `ms`). A key not listed is judged as an unregistered
 * property (P1 QA13: every value `animate` takes is checked).
 */
export const ANIMATION_OPTIONS = Object.freeze(
  new Map([
    ['duration', 'animation-duration'],
    ['delay', 'animation-delay'],
    ['endDelay', 'animation-delay'],
    ['easing', 'animation-timing-function'],
    ['iterations', 'animation-iteration-count'],
    ['direction', 'animation-direction'],
    ['fill', 'animation-fill-mode'],
  ]),
);

/** Type aliases that keep the keys of the style type they wrap (`Partial<CSSProperties>`). */
export const STYLE_TYPE_WRAPPERS = Object.freeze(
  new Set(['Partial', 'Required', 'Readonly', 'Pick', 'Omit']),
);

/** Style declaration interfaces whose members and `setProperty` write CSS properties. */
export const STYLE_DECLARATIONS = Object.freeze(
  new Set(['CSSStyleDeclaration', 'CSSStyleProperties']),
);

/**
 * Art stylesheets (plan D7): every class in every selector carries the sheet's prefix (`prefix`,
 * `prefix-*` or `prefix__*`). Their values take the value rules like any sheet's: a written
 * value is debt the baseline holds, and a new one is reported (user's whitelist rule, 14:43).
 */
export const ART_SHEETS = Object.freeze({
  'packages/web/src/boot/bootSplash.css': 'boot',
  'packages/web/src/components/nameStyles/nameStyles.css': 'name-style',
  'packages/web/src/features/gacha/machine/CapsuleMachine.css': 'capsule-machine',
  'packages/web/src/routes/bench/SceneBench.css': 'bench',
  'packages/web/src/scene/scene.css': 'scene-canvas',
  'packages/web/src/theme/nightArt.css': 'night-art',
});

export const AT_RULES = Object.freeze([
  'media',
  'keyframes',
  'supports',
  'container',
  'import',
  'starting-style',
]);

/** Every CSS function a stylesheet may call, by its exact canonical spelling (no vendor prefix). */
export const FUNCTIONS = Object.freeze(
  new Set([
    'var',
    'env',
    'calc',
    'min',
    'max',
    'clamp',
    'url',
    'image-set',
    'linear-gradient',
    'radial-gradient',
    'conic-gradient',
    'repeating-linear-gradient',
    'cubic-bezier',
    'steps',
    'translate',
    'translateX',
    'translateY',
    'translate3d',
    'scale',
    'scaleX',
    'scaleY',
    'rotate',
    'rotateX',
    'rotateY',
    'skewX',
    'perspective',
    'blur',
    'brightness',
    'contrast',
    'drop-shadow',
    'grayscale',
    'saturate',
    'repeat',
    'minmax',
    'fit-content',
    'inset',
    'polygon',
    'circle',
    'ellipse',
    'rect',
    'attr',
    'counter',
  ]),
);

const GLOBAL_KEYWORDS = ['inherit', 'initial', 'unset', 'revert', 'revert-layer'];

/** Functions every token domain accepts: references and arithmetic over atoms. */
const MATH_FUNCTIONS = ['calc', 'min', 'max', 'clamp'];

/**
 * Layout ratios a size, offset or track may use as literals: they are not design sizes. Viewport
 * ratios are the dynamic, small and large units only: Modern Web Guidance `responsive-design`
 * says to use `dvh`/`dvw` instead of `vh`/`vw`, which break when the mobile browser UI shows or
 * hides. Container query units are registered with them (`css`: `cqi`/`cqb` instead of
 * repeating box model values).
 */
const RATIO_UNITS = [
  '%',
  ...['dvw', 'dvh', 'dvmin', 'dvmax', 'svw', 'svh', 'svmin', 'svmax'],
  ...['lvw', 'lvh', 'lvmin', 'lvmax', 'cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax'],
];
const SIZE_KEYWORDS = ['auto', 'none', 'fit-content', 'min-content', 'max-content', 'stretch'];
const POSITION_KEYWORDS = ['center', 'top', 'bottom', 'left', 'right'];

/**
 * Token domains. A value in a domain is a sequence of atoms: `var()` (its fallback read in the
 * same domain), a global keyword, zero, a domain keyword, a domain literal, or a math function
 * over atoms where the only bare number is the sign flip `-1`. `units` lists the literal units a
 * domain accepts (layout ratios, angles), also inside math; `unitless` accepts plain numbers
 * outside math (counts, factors, flex weights), everywhere (`true`) or only in the listed
 * functions and properties; `idents` accepts custom identifiers (animation and property names);
 * `literals` lists exact words (opacity `1`). The first argument of `env()` is a reference; what
 * `url()` may reference is fixed in `values.mjs`.
 */
export const DOMAINS = Object.freeze({
  radius: { keywords: [] },
  spacing: { keywords: ['auto'], functions: ['env'] },
  font: { keywords: ['normal'] },
  layer: { keywords: ['auto'] },
  'line-width': { keywords: [] },
  size: { keywords: SIZE_KEYWORDS, units: RATIO_UNITS, functions: ['env', 'fit-content'] },
  track: {
    keywords: [...SIZE_KEYWORDS, 'subgrid', 'auto-fill', 'auto-fit'],
    unitless: true,
    units: [...RATIO_UNITS, 'fr'],
    functions: ['env', 'repeat', 'minmax', 'fit-content'],
  },
  flex: { keywords: [...SIZE_KEYWORDS, 'content'], unitless: true, units: RATIO_UNITS },
  offset: { keywords: ['auto'], units: RATIO_UNITS, functions: ['env'] },
  transform: {
    keywords: ['none'],
    // A plain number is a factor only in `scale` (P1 QA17 N1): elsewhere it is a length or an
    // angle written without its unit, as SVG's `transform="translate(37 12)"` writes user units.
    unitless: {
      functions: ['scale', 'scaleX', 'scaleY', 'scaleZ', 'scale3d'],
      properties: ['scale'],
    },
    units: ['%', 'deg', 'turn', 'rad'],
    functions: [
      'translate',
      'translateX',
      'translateY',
      'translate3d',
      'scale',
      'scaleX',
      'scaleY',
      'rotate',
      'rotateX',
      'rotateY',
      'skewX',
    ],
  },
  origin: { keywords: POSITION_KEYWORDS, units: ['%'] },
  opacity: { keywords: [], literals: ['1'] },
  align: {
    keywords: ['baseline', 'sub', 'super', 'text-top', 'text-bottom', 'middle', 'top', 'bottom'],
  },
  shadow: { keywords: ['none', 'inset'], colors: true },
  border: {
    keywords: ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double'],
    colors: true,
  },
  motion: {
    keywords: [],
    idents: true,
    unitless: true,
    functions: ['cubic-bezier', 'steps'],
  },
  color: { keywords: ['none'], colors: true },
  /** SVG `fill`/`stroke`: a color, or a paint server `url(#id)`. */
  'svg-paint': {
    keywords: ['none', 'context-fill', 'context-stroke'],
    colors: true,
    functions: ['url'],
  },
  paint: {
    keywords: [
      'none',
      'auto',
      'no-repeat',
      'repeat',
      'repeat-x',
      'repeat-y',
      ...POSITION_KEYWORDS,
      'cover',
      'contain',
      'to',
      'at',
      'circle',
      'ellipse',
      'closest-side',
      'farthest-side',
      'farthest-corner',
      'border-box',
      'padding-box',
      'content-box',
      'text',
      'underline',
      'line-through',
      'solid',
      'dashed',
      'dotted',
      'wavy',
      'from-font',
    ],
    colors: true,
    units: ['%', 'deg', 'turn'],
    functions: [
      'url',
      'image-set',
      'linear-gradient',
      'radial-gradient',
      'conic-gradient',
      'repeating-linear-gradient',
      'blur',
      'brightness',
      'contrast',
      'drop-shadow',
      'grayscale',
      'saturate',
    ],
  },
  /**
   * `clip-path`: a basic shape or a fragment reference. Its lengths are tokens or percentages of
   * the reference box, like every length (P1 QA18 F2); the corner radius after `round` too.
   */
  shape: {
    keywords: [
      'none',
      ...POSITION_KEYWORDS,
      'at',
      'round',
      'closest-side',
      'farthest-side',
      'nonzero',
      'evenodd',
      'margin-box',
      'border-box',
      'padding-box',
      'content-box',
      'fill-box',
      'stroke-box',
      'view-box',
    ],
    units: ['%'],
    functions: ['inset', 'circle', 'ellipse', 'polygon', 'rect', 'url'],
  },
  /**
   * A custom property defined outside the token sheet (S4): it only aliases tokens (references,
   * zero, global keywords, colors keywords), so no literal hides behind a local variable.
   */
  custom: { keywords: [], colors: true, functions: ['env'] },
});
export const DOMAIN_COMMON = Object.freeze({
  keywords: GLOBAL_KEYWORDS,
  functions: ['var', ...MATH_FUNCTIONS],
});

/** System colors, valid only inside exactly `@media (forced-colors: active)`. */
export const SYSTEM_COLORS = Object.freeze(
  new Set([
    'canvas',
    'canvastext',
    'linktext',
    'visitedtext',
    'activetext',
    'buttonface',
    'buttontext',
    'buttonborder',
    'field',
    'fieldtext',
    'highlight',
    'highlighttext',
    'selecteditem',
    'selecteditemtext',
    'mark',
    'marktext',
    'graytext',
    'accentcolor',
    'accentcolortext',
  ]),
);
export const FORCED_COLORS_MEDIA = '(forced-colors:active)';

/**
 * `@media` and `@container` conditions (P1 QA12 nit 8): the features they may test, each with
 * the keywords it may be tested for (a range feature takes a length that is a registered
 * breakpoint) and the words between them. A breakpoint
 * cannot be a `var()`, so the breakpoint scale is a registered list; P3 sets it with the other
 * semantic tokens, and until then every length in a condition is debt the baseline holds.
 */
export const CONDITION_FEATURES = Object.freeze(
  new Map([
    // Discrete features: the keywords each may be tested for (P1 QA13 nit N2).
    ['hover', Object.freeze(new Set(['hover', 'none']))],
    ['pointer', Object.freeze(new Set(['coarse', 'fine', 'none']))],
    ['prefers-reduced-motion', Object.freeze(new Set(['no-preference', 'reduce']))],
    ['forced-colors', Object.freeze(new Set(['active', 'none']))],
    // Range features: a registered breakpoint, never a keyword.
    ...['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'].map((feature) => [
      feature,
      Object.freeze(new Set()),
    ]),
  ]),
);
export const CONDITION_WORDS = Object.freeze(new Set(['and', 'not', 'only', 'or']));
export const BREAKPOINTS = Object.freeze(new Set());

const domainOf = (domain, names) => names.map((name) => [name, domain]);
const sides = (prefix, suffix = '') =>
  [
    '',
    '-top',
    '-right',
    '-bottom',
    '-left',
    '-block',
    '-inline',
    '-block-start',
    '-block-end',
    '-inline-start',
    '-inline-end',
  ].map((side) => `${prefix}${side}${suffix}`);

/**
 * Every property a stylesheet may set, by lower-case name without a vendor prefix: a token
 * domain, or `free` for properties whose value syntax holds only keywords and counts (display,
 * alignment, flex and grid placement, overflow, behaviour). An unregistered property is reported.
 */
export const PROPERTIES = Object.freeze(
  new Map([
    ...domainOf('radius', [
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
      'border-start-start-radius',
      'border-start-end-radius',
      'border-end-start-radius',
      'border-end-end-radius',
    ]),
    ...domainOf('spacing', [
      ...sides('padding'),
      ...sides('margin'),
      'gap',
      'row-gap',
      'column-gap',
      'grid-gap',
      'grid-row-gap',
      'grid-column-gap',
      ...sides('scroll-margin'),
      ...sides('scroll-padding'),
    ]),
    ...domainOf('font', [
      'font',
      'font-size',
      'line-height',
      'font-weight',
      'letter-spacing',
      'word-spacing',
      'font-family',
      'font-variation-settings',
    ]),
    ...domainOf('layer', ['z-index']),
    ...domainOf('line-width', [
      ...sides('border', '-width'),
      'outline-width',
      'outline-offset',
      'column-rule-width',
      'text-decoration-thickness',
      'text-underline-offset',
      'stroke-width',
      'stroke-dasharray',
      'stroke-dashoffset',
    ]),
    ...domainOf('shadow', ['box-shadow', 'text-shadow']),
    ...domainOf('border', [...sides('border'), 'outline', 'column-rule']),
    ...domainOf('motion', [
      'transition',
      'transition-property',
      'transition-duration',
      'transition-delay',
      'transition-timing-function',
      'transition-behavior',
      'animation',
      'animation-name',
      'animation-duration',
      'animation-delay',
      'animation-timing-function',
      'animation-iteration-count',
      'animation-direction',
      'animation-fill-mode',
      'animation-play-state',
    ]),
    ...domainOf('color', [
      'color',
      'background-color',
      ...sides('border', '-color'),
      'outline-color',
      'text-decoration-color',
      'column-rule-color',
      'accent-color',
      'caret-color',
      'stop-color',
      'flood-color',
      'tap-highlight-color',
      'scrollbar-color',
    ]),
    ...domainOf('paint', [
      'background',
      'background-image',
      'background-position',
      'background-size',
      'background-repeat',
      'background-clip',
      'background-origin',
      'background-attachment',
      'mask',
      'mask-image',
      'mask-position',
      'mask-size',
      'mask-repeat',
      'filter',
      'backdrop-filter',
      'text-decoration',
      'text-decoration-line',
      'text-decoration-style',
    ]),
    ...domainOf('shape', ['clip-path']),
    ...domainOf('size', [
      'width',
      'height',
      'min-width',
      'min-height',
      'max-width',
      'max-height',
      'block-size',
      'inline-size',
      'min-block-size',
      'min-inline-size',
      'max-block-size',
      'max-inline-size',
      'flex-basis',
      'perspective',
    ]),
    ...domainOf('track', [
      'grid-template',
      'grid-template-columns',
      'grid-template-rows',
      'grid-auto-columns',
      'grid-auto-rows',
    ]),
    ...domainOf('flex', ['flex']),
    ...domainOf('offset', [
      'top',
      'right',
      'bottom',
      'left',
      'inset',
      'inset-block',
      'inset-inline',
      'inset-block-start',
      'inset-block-end',
      'inset-inline-start',
      'inset-inline-end',
      'translate',
    ]),
    ...domainOf('transform', ['transform', 'rotate', 'scale']),
    ...domainOf('origin', ['transform-origin', 'perspective-origin', 'object-position']),
    ...domainOf('opacity', [
      'opacity',
      'fill-opacity',
      'stroke-opacity',
      'stop-opacity',
      'flood-opacity',
    ]),
    ...domainOf('align', ['vertical-align']),
    ...domainOf('svg-paint', ['fill', 'stroke']),
    ...domainOf('free', [
      'display',
      'align-content',
      'align-items',
      'align-self',
      'justify-content',
      'justify-items',
      'justify-self',
      'place-content',
      'place-items',
      'place-self',
      'flex-direction',
      'flex-flow',
      'flex-grow',
      'flex-shrink',
      'flex-wrap',
      'order',
      'grid-area',
      'grid-column',
      'grid-row',
      'grid-template-areas',
      'grid-auto-flow',
      'position',
      'aspect-ratio',
      'box-sizing',
      'overflow',
      'overflow-x',
      'overflow-y',
      'overflow-wrap',
      'overscroll-behavior',
      'overscroll-behavior-x',
      'overscroll-behavior-y',
      'object-fit',
      'visibility',
      'pointer-events',
      'cursor',
      'user-select',
      'touch-action',
      'transform-style',
      'backface-visibility',
      'isolation',
      'content',
      'list-style',
      'white-space',
      'text-align',
      'text-overflow',
      'text-wrap',
      'text-transform',
      'word-break',
      'float',
      'table-layout',
      'border-collapse',
      'border-style',
      'outline-style',
      'resize',
      'field-sizing',
      'appearance',
      'will-change',
      'contain',
      'container',
      'container-type',
      'container-name',
      'color-scheme',
      'scroll-behavior',
      'scrollbar-width',
      'font-style',
      'font-variant-numeric',
      'line-clamp',
      'box-orient',
      'text-size-adjust',
      'touch-callout',
      'stroke-linecap',
      'stroke-linejoin',
    ]),
  ]),
);

// ---------------------------------------------------------------------------------------------
// TSX elements (§2 E11)
// ---------------------------------------------------------------------------------------------

/**
 * Native elements one file may create besides `ELEMENTS`: an `iframe` hosts another document, so
 * only the dev preview shell, which frames the app at device widths, creates one (P1 QA11 F5).
 */
export const FILE_ELEMENTS = Object.freeze({
  'packages/web/preview/PreviewApp.tsx': Object.freeze(['iframe']),
});

/** Native elements JSX and React `createElement` may create; `style`, `link`, `script` are not. */
export const ELEMENTS = Object.freeze(
  new Set([
    'article',
    'aside',
    'b',
    'br',
    'button',
    'canvas',
    'caption',
    'circle',
    'code',
    'datalist',
    'dd',
    'defs',
    'details',
    'dialog',
    'div',
    'dl',
    'dt',
    'feGaussianBlur',
    'fieldset',
    'figcaption',
    'figure',
    'filter',
    'footer',
    'form',
    'g',
    'h1',
    'h2',
    'h3',
    'h4',
    'header',
    'hr',
    'img',
    'input',
    'label',
    'legend',
    'li',
    'line',
    'linearGradient',
    'main',
    'nav',
    'ol',
    'option',
    'p',
    'path',
    'pre',
    'progress',
    'radialGradient',
    'rect',
    'section',
    'select',
    'small',
    'span',
    'stop',
    'strong',
    'summary',
    'svg',
    'table',
    'tbody',
    'td',
    'textarea',
    'th',
    'thead',
    'time',
    'tr',
    'ul',
  ]),
);

/**
 * The attributes a native element may carry besides the ones whose value `ui/inline-style-keys`
 * judges (`style`, `SVG_ATTRIBUTES`, and `SIZE_ATTRIBUTES` on `SIZE_HOSTS`) and the open
 * families `aria-*`, `data-*` and React's `on*` handlers: attribute → the elements that take it
 * (`*`: every element). Their values are content, behaviour, or an SVG element's geometry in its
 * own user units, never a style value. Any other attribute, written or spread, is reported, so a
 * presentational hint (`bgcolor`, `cellPadding`, a `width` on a table) is not written past the
 * value check (P1 QA14 F5, F6).
 */
export const ATTRIBUTES = Object.freeze(
  new Map(
    Object.entries({
      // Global: identity, behaviour and accessibility.
      children: ['*'],
      className: ['*'],
      hidden: ['*'],
      id: ['*'],
      inert: ['*'],
      key: ['*'],
      ref: ['*'],
      role: ['*'],
      tabIndex: ['*'],
      title: ['*'],
      draggable: ['*'],
      // Form controls, links to them, and their content.
      accept: ['input'],
      autoComplete: ['input'],
      autoCorrect: ['input'],
      autoFocus: ['input'],
      checked: ['input'],
      defaultValue: ['input', 'textarea'],
      disabled: ['button', 'fieldset', 'input', 'option', 'select', 'textarea'],
      enterKeyHint: ['input'],
      form: ['button'],
      htmlFor: ['label'],
      inputMode: ['input'],
      list: ['input'],
      max: ['input', 'progress'],
      maxLength: ['input', 'textarea'],
      min: ['input'],
      name: ['input', 'select', 'textarea'],
      placeholder: ['input', 'textarea'],
      readOnly: ['input', 'textarea'],
      required: ['input', 'textarea'],
      rows: ['textarea'],
      step: ['input'],
      type: ['button', 'input'],
      value: ['input', 'option', 'progress', 'select', 'textarea'],
      // Disclosure, tables, time and images (content, not presentation).
      open: ['details'],
      colSpan: ['td'],
      scope: ['th'],
      dateTime: ['time'],
      alt: ['img'],
      crossOrigin: ['img'],
      decoding: ['img'],
      src: ['iframe', 'img'],
      // SVG geometry and coordinate systems, in the element's own user units: the drawing of an
      // icon or illustration, its content like an image's pixels (U7), not a spacing, size or
      // colour of the design system; paint and stroke are presentation attributes, judged (E4).
      cx: ['circle', 'radialGradient'],
      cy: ['circle', 'radialGradient'],
      r: ['circle', 'radialGradient'],
      d: ['path'],
      x: ['filter', 'rect'],
      y: ['filter', 'rect'],
      width: ['filter', 'rect'],
      height: ['filter', 'rect'],
      x1: ['line', 'linearGradient'],
      x2: ['line', 'linearGradient'],
      y1: ['line', 'linearGradient'],
      y2: ['line', 'linearGradient'],
      offset: ['stop'],
      pathLength: ['circle', 'path'],
      viewBox: ['svg'],
      preserveAspectRatio: ['svg'],
      gradientUnits: ['linearGradient', 'radialGradient'],
      filterUnits: ['filter'],
      // The blur's standard deviation, in the filter's user units.
      stdDeviation: ['feGaussianBlur'],
    }).map(([name, elements]) => [name, Object.freeze(new Set(elements))]),
  ),
);
/** Attribute families any native element may carry: ARIA, data, and React's event handlers. */
export const OPEN_ATTRIBUTES = Object.freeze([/^aria-/, /^data-/, /^on[A-Z]/]);

// ---------------------------------------------------------------------------------------------
// Inline styles and SVG presentation attributes (§2 E4)
// ---------------------------------------------------------------------------------------------

/**
 * Style keys React writes as plain numbers; any other number gets `px`. The subset of React's
 * unitless list that the registry's domains use: a key missing here gets `px` and is reported
 * as a length, never passed.
 */
export const REACT_UNITLESS = Object.freeze(
  new Set([
    'animationIterationCount',
    'aspectRatio',
    'columnCount',
    'flex',
    'flexGrow',
    'flexShrink',
    'gridArea',
    'gridColumn',
    'gridColumnEnd',
    'gridColumnStart',
    'gridRow',
    'gridRowEnd',
    'gridRowStart',
    'fontWeight',
    'lineClamp',
    'lineHeight',
    'opacity',
    'order',
    'scale',
    'zIndex',
    'zoom',
    'fillOpacity',
    'floodOpacity',
    'stopOpacity',
    'strokeDasharray',
    'strokeDashoffset',
    'strokeMiterlimit',
    'strokeOpacity',
    'strokeWidth',
  ]),
);

/**
 * SVG presentation attributes (JSX name) and the CSS property whose domain judges them: every
 * presentation attribute SVG 2 defines (P1 QA13 F3), so an attribute that styles is never left
 * unchecked. `rx`/`ry` round a box, so they take the radius domain. The geometry attributes
 * (`x`, `cx`, `r`, `d`, `points`, `viewBox`, `x1`…) are not here: they place the drawing in its
 * own user coordinates, which no token measures.
 */
export const SVG_ATTRIBUTES = Object.freeze(
  new Map([
    ['alignmentBaseline', 'alignment-baseline'],
    ['baselineShift', 'baseline-shift'],
    ['clipPath', 'clip-path'],
    ['clipRule', 'clip-rule'],
    ['color', 'color'],
    ['colorInterpolation', 'color-interpolation'],
    ['colorInterpolationFilters', 'color-interpolation-filters'],
    ['cursor', 'cursor'],
    ['direction', 'direction'],
    ['display', 'display'],
    ['dominantBaseline', 'dominant-baseline'],
    ['fill', 'fill'],
    ['fillOpacity', 'fill-opacity'],
    ['fillRule', 'fill-rule'],
    ['filter', 'filter'],
    ['floodColor', 'flood-color'],
    ['floodOpacity', 'flood-opacity'],
    ['fontFamily', 'font-family'],
    ['fontSize', 'font-size'],
    ['fontSizeAdjust', 'font-size-adjust'],
    ['fontStretch', 'font-stretch'],
    ['fontStyle', 'font-style'],
    ['fontVariant', 'font-variant'],
    ['fontWeight', 'font-weight'],
    ['imageRendering', 'image-rendering'],
    ['letterSpacing', 'letter-spacing'],
    ['lightingColor', 'lighting-color'],
    ['markerEnd', 'marker-end'],
    ['markerMid', 'marker-mid'],
    ['markerStart', 'marker-start'],
    ['mask', 'mask'],
    ['opacity', 'opacity'],
    ['overflow', 'overflow'],
    ['paintOrder', 'paint-order'],
    ['pointerEvents', 'pointer-events'],
    ['rx', 'border-radius'],
    ['ry', 'border-radius'],
    ['shapeRendering', 'shape-rendering'],
    ['stopColor', 'stop-color'],
    ['stopOpacity', 'stop-opacity'],
    ['stroke', 'stroke'],
    ['strokeDasharray', 'stroke-dasharray'],
    ['strokeDashoffset', 'stroke-dashoffset'],
    ['strokeLinecap', 'stroke-linecap'],
    ['strokeLinejoin', 'stroke-linejoin'],
    ['strokeMiterlimit', 'stroke-miterlimit'],
    ['strokeOpacity', 'stroke-opacity'],
    ['strokeWidth', 'stroke-width'],
    ['textAnchor', 'text-anchor'],
    ['textDecoration', 'text-decoration'],
    ['textRendering', 'text-rendering'],
    ['transform', 'transform'],
    ['transformOrigin', 'transform-origin'],
    ['unicodeBidi', 'unicode-bidi'],
    ['vectorEffect', 'vector-effect'],
    ['visibility', 'visibility'],
    ['wordSpacing', 'word-spacing'],
    ['writingMode', 'writing-mode'],
  ]),
);

/**
 * The DOM methods that write a style value, by `Interface.member` as the default library declares
 * them: `ui/inline-style-keys` judges each call's value (E4), and any reference to one that is not
 * a direct call is reported (P1 QA14 F4). Which files may call them at all is `DOM_WRITERS`'.
 */
export const DOM_VALUE_WRITERS = Object.freeze(
  new Map([
    ['Animatable.animate', 'animate'],
    ['CSSStyleDeclarationBase.setProperty', 'setProperty'],
    ['Element.setAttribute', 'setAttribute'],
    ['Element.setAttributeNS', 'setAttributeNS'],
    ['KeyframeEffect.setKeyframes', 'setKeyframes'],
    ['AnimationEffect.updateTiming', 'updateTiming'],
  ]),
);

/**
 * What a third-party package does with each key we hand it, by the package whose declaration
 * holds the key (P1 QA17 F1/F3, QA18 F1, QA19 F1/F2). A package renders our values where the gate
 * does not see them (sonner writes `offset` into `--offset-*`, snapdom paints `backgroundColor`),
 * so a key it declares and this table does not list is reported (`prop`). A key is named by the
 * declaration holding it: `Holder.key` for a property, `Holder.fn(param)` for a positional
 * argument (`fn(param)` for a free function), so one name that means two things in a package
 * (Pixi's `width` of a stroke and of a renderer) is registered once per meaning. Each key is
 * `plain` (behaviour or content, never a style value), `options` (an object literal whose keys
 * are judged where written) or the CSS property its value is judged as. A whole package is
 * `all: 'plain'` only when it renders nothing; a package that renders lists its keys, so every
 * key of an API not used yet is reported until registered. A value whose keys are not written
 * out where it is handed to a package's type (a spread, a variable, a computed key) is reported
 * (`handover`). React's DOM attribute interfaces (`SVGAttributes`, …) are judged as the
 * attributes they become (`SIZE_HOSTS`, `SVG_ATTRIBUTES`), and `CSSProperties` as style
 * declarations, not here.
 */
const plain = (keys) => Object.fromEntries(keys.map((key) => [key, 'plain']));

export const PACKAGE_PROPS = Object.freeze({
  '@tanstack/query-core': { all: 'plain', why: 'data fetching; renders nothing' },
  '@tanstack/react-query': { all: 'plain', why: 'data fetching; renders nothing' },
  zod: { all: 'plain', why: 'validation; renders nothing' },
  'pinyin-pro': { all: 'plain', why: 'text conversion; renders nothing' },
  msw: { all: 'plain', why: 'admin mock worker; renders nothing' },
  vite: { all: 'plain', why: '`import.meta.glob` options, read at build time' },
  '@types/node': { all: 'plain', why: 'timers; render nothing' },
  '@types/react-dom': { all: 'plain', why: '`createRoot`; renders what we render' },
  '@zag-js/color-utils': { all: 'plain', why: 'colour conversion of a value judged where written' },
  colord: {
    all: 'plain',
    why: 'colour objects (`HslColor`, …) Pixi accepts as fill colours: canvas content (U7)',
  },
  uqr: { all: 'plain', why: 'QR matrix encoding; the code is drawn by Ark from our CSS' },
  // Hooks, context, refs, `memo`, `lazy`, `Suspense`. `createElement`'s props are an options
  // object: each key is judged as a prop of the component it is handed to.
  '@types/react': {
    keys: {
      ...plain([
        'ActionDispatch(args)',
        'Dispatch(value)',
        'ProviderProps.value',
        'RefObject.current',
        'SuspenseProps.fallback',
        'createContext(defaultValue)',
        'createElement(type)',
        'lazy(load)',
        'memo(Component)',
        'use(usable)',
        'useCallback(callback)',
        'useCallback(deps)',
        'useContext(context)',
        'useEffect(deps)',
        'useEffect(effect)',
        'useEffectEvent(callback)',
        'useImperativeHandle(deps)',
        'useImperativeHandle(init)',
        'useImperativeHandle(ref)',
        'useLayoutEffect(deps)',
        'useLayoutEffect(effect)',
        'useMemo(deps)',
        'useMemo(factory)',
        'useReducer(initialState)',
        'useReducer(reducer)',
        'useRef(initialValue)',
        'useState(initialState)',
        'useSyncExternalStore(getServerSnapshot)',
        'useSyncExternalStore(getSnapshot)',
        'useSyncExternalStore(subscribe)',
      ]),
      'createElement(props)': 'options',
      // A React element handed on as content (`element={<Page />}`), judged where written.
      ...plain([
        'ReactElement.key',
        'ReactElement.props',
        'ReactElement.type',
        'ReactPortal.children',
        // A promise handed to `use`, whose settlement React reads.
        'FulfilledReactPromise.status',
        'FulfilledReactPromise.value',
        'PendingReactPromise.status',
        'RejectedReactPromise.reason',
        'RejectedReactPromise.status',
        'UntrackedReactPromise.reason',
        'UntrackedReactPromise.status',
        'UntrackedReactPromise.value',
      ]),
    },
  },
  // Error reporting. The Feedback widget (`feedbackIntegration`), which paints our colours into
  // its own DOM, is not registered: its options are reported.
  '@sentry/core': {
    keys: plain([
      'ClientOptions.denyUrls',
      'ClientOptions.dsn',
      'ClientOptions.enabled',
      'ClientOptions.environment',
      'ClientOptions.ignoreErrors',
      'ClientOptions.release',
      'ClientOptions.tracesSampleRate',
      'CoreOptions.integrations',
      'Scope.setFingerprint(fingerprint)',
      'Scope.setTag(key)',
      'Scope.setTag(value)',
      'ScopeContext.mutationKey',
      'ScopeContext.queryKey',
      'ScopeContext.tags',
      'User.id',
      'captureException(exception)',
      'captureException(hint)',
      'error(attributes)',
      'error(message)',
      'setUser(user)',
      'withScope(callback)',
    ]),
  },
  '@sentry/react': {
    keys: plain([
      'CreateRouterFunction(routes)',
      'init(options)',
      'wrapCreateBrowserRouter(createRouterFunction)',
    ]),
  },
  // Pixi draws into its own canvas: shape geometry, colours and filters are canvas content (U7).
  // Not registered, so reported: `ViewSystemOptions.autoDensity` and `AbstractRenderer.resize`,
  // which with it write the canvas element's CSS box size; and `DOMContainer`'s options and
  // `element`, the element of ours whose `transform`/`opacity` it writes.
  'pixi.js': {
    keys: plain([
      // A canvas, fill style or fill pattern of ours handed to Pixi as a surface or fill: canvas
      // content (U7). A canvas's `style` is written only with `autoDensity`, not registered.
      'FillStyle.alpha',
      'FillStyle.matrix',
      'FillStyle.texture',
      'FillStyle.textureSpace',
      'OffscreenCanvas.getContext',
      'StrokeAttributes.pixelLine',
      'FillPattern._texture',
      'FillPattern._tick',
      'FillPattern.destroy',
      'FillPattern.setTransform',
      'FillPattern.styleKey',
      'FillPattern.texture',
      'FillPattern.textureSpace',
      'FillPattern.transform',
      'FillPattern.uid',
      'HTMLCanvasElement.getContext',
      'ICanvas.addEventListener',
      'ICanvas.convertToBlob',
      'ICanvas.dispatchEvent',
      'ICanvas.getBoundingClientRect',
      'ICanvas.getContext',
      'ICanvas.height',
      'ICanvas.parentNode',
      'ICanvas.removeEventListener',
      'ICanvas.style',
      'ICanvas.toBlob',
      'ICanvas.toDataURL',
      'ICanvas.width',
      'AbstractRenderer.destroy(options)',
      'AbstractRenderer.init(options)',
      'AbstractRenderer.render(options)',
      'AlphaFilter(options)',
      'AlphaFilter.alpha',
      'AlphaFilterOptions.alpha',
      'BackgroundSystemOptions.backgroundAlpha',
      'BaseDestroyOptions.children',
      'BaseGradientOptions.colorStops',
      'BaseGradientOptions.textureSpace',
      'BlurFilter(options)',
      'BlurFilter.strength',
      'BlurFilterOptions.strength',
      'Color(value)',
      'Color.alpha',
      'Container(options)',
      'Container.addChild(children)',
      'Container.alpha',
      'Container.blendMode',
      'Container.destroy(options)',
      'Container.removeChild(children)',
      'Container.rotation',
      'Container.visible',
      'Container.x',
      'ContainerOptions.tint',
      'ContainerOptions.visible',
      'ContextSystemOptions.preferWebGLVersion',
      'EffectsMixin.filters',
      'EffectsMixin.mask',
      'EffectsMixin.setMask(options)',
      'FillGradient(options)',
      'FillStyle.color',
      'FillStyle.fill',
      'Filter.blendMode',
      'Filter.enabled',
      'Filter.padding',
      'FilterOptions.antialias',
      'FilterOptions.resolution',
      'Graphics(options)',
      'Graphics.arc(endAngle)',
      'Graphics.arc(radius)',
      'Graphics.arc(startAngle)',
      'Graphics.arc(x)',
      'Graphics.arc(y)',
      'Graphics.circle(radius)',
      'Graphics.circle(x)',
      'Graphics.circle(y)',
      'Graphics.context',
      'Graphics.ellipse(radiusX)',
      'Graphics.ellipse(radiusY)',
      'Graphics.ellipse(x)',
      'Graphics.ellipse(y)',
      'Graphics.fill(style)',
      'Graphics.lineTo(x)',
      'Graphics.lineTo(y)',
      'Graphics.moveTo(x)',
      'Graphics.moveTo(y)',
      'Graphics.path(path)',
      'Graphics.poly(points)',
      'Graphics.quadraticCurveTo(cpx)',
      'Graphics.quadraticCurveTo(cpy)',
      'Graphics.quadraticCurveTo(x)',
      'Graphics.quadraticCurveTo(y)',
      'Graphics.rect(h)',
      'Graphics.rect(w)',
      'Graphics.rect(x)',
      'Graphics.rect(y)',
      'Graphics.roundRect(h)',
      'Graphics.roundRect(radius)',
      'Graphics.roundRect(w)',
      'Graphics.roundRect(x)',
      'Graphics.roundRect(y)',
      'Graphics.stroke(args)',
      'Graphics.translateTransform(x)',
      'Graphics.translateTransform(y)',
      'GraphicsContext.arc(endAngle)',
      'GraphicsContext.arc(radius)',
      'GraphicsContext.arc(startAngle)',
      'GraphicsContext.arc(x)',
      'GraphicsContext.arc(y)',
      'GraphicsContext.circle(radius)',
      'GraphicsContext.circle(x)',
      'GraphicsContext.circle(y)',
      'GraphicsContext.ellipse(radiusX)',
      'GraphicsContext.ellipse(radiusY)',
      'GraphicsContext.ellipse(x)',
      'GraphicsContext.ellipse(y)',
      'GraphicsContext.fill(style)',
      'GraphicsContext.lineTo(x)',
      'GraphicsContext.lineTo(y)',
      'GraphicsContext.moveTo(x)',
      'GraphicsContext.moveTo(y)',
      'GraphicsContext.path(path)',
      'GraphicsContext.rect(h)',
      'GraphicsContext.rect(w)',
      'GraphicsContext.rect(x)',
      'GraphicsContext.rect(y)',
      'GraphicsContext.roundRect(h)',
      'GraphicsContext.roundRect(radius)',
      'GraphicsContext.roundRect(w)',
      'GraphicsContext.roundRect(x)',
      'GraphicsContext.roundRect(y)',
      'GraphicsContext.setTransform(a)',
      'GraphicsContext.setTransform(b)',
      'GraphicsContext.setTransform(c)',
      'GraphicsContext.setTransform(d)',
      'GraphicsContext.setTransform(dx)',
      'GraphicsContext.setTransform(dy)',
      'GraphicsContext.stroke(style)',
      'GraphicsContext.translate(x)',
      'GraphicsContext.translate(y)',
      'GraphicsPath(instructions)',
      'ImageSource(options)',
      'LinearGradientOptions.end',
      'LinearGradientOptions.start',
      'LinearGradientOptions.type',
      'MaskOptions.inverse',
      'MaskOptionsAndMask.mask',
      'ObservablePoint.set(x)',
      'ObservablePoint.set(y)',
      'PointData.x',
      'PointData.y',
      'RadialGradientOptions.center',
      'RadialGradientOptions.innerRadius',
      'RadialGradientOptions.outerCenter',
      'RadialGradientOptions.outerRadius',
      'RenderOptions.container',
      'SharedRendererOptions.skipExtensionImports',
      'SortMixinConstructor.sortableChildren',
      'SortMixinConstructor.zIndex',
      'Sprite(options)',
      'Sprite.texture',
      'SpriteOptions.anchor',
      'SpriteOptions.texture',
      'StrokeAttributes.alignment',
      'StrokeAttributes.cap',
      'StrokeAttributes.join',
      'StrokeAttributes.miterLimit',
      'StrokeAttributes.width',
      'SystemRunner.add(item)',
      'SystemRunner.remove(item)',
      'Text(options)',
      'TextOptions.style',
      'TextOptions.text',
      'TextStyle.fill',
      'TextStyle.fontSize',
      'Texture(0)',
      'Texture.destroy(destroySource)',
      'TextureOptions.source',
      'TextureSourceOptions.alphaMode',
      'TextureSourceOptions.autoGenerateMipmaps',
      'TextureSourceOptions.resolution',
      'TextureSourceOptions.resource',
      'Ticker.add(fn)',
      'Ticker.maxFPS',
      'ViewSystemDestroyOptions.removeView',
      'ViewSystemOptions.antialias',
      'ViewSystemOptions.canvas',
      'ViewSystemOptions.resolution',
    ]),
  },
  sonner: {
    keys: {
      'toast(data)': 'options',
      ...plain([
        'toast(message)',
        'ExternalToast.id',
        'ToastT.closeButton',
        'ToastT.description',
        'ToastT.duration',
        'ToasterProps.position',
        'dismiss(id)',
        'error(message)',
        'info(message)',
        'success(message)',
        'warning(message)',
      ]),
      'info(data)': 'options',
      'success(data)': 'options',
      'warning(data)': 'options',
    },
  },
  '@zumer/snapdom': {
    keys: {
      // The element captured, and the capture rectangle and pixel ratio of our own DOM: the
      // image's geometry, not a style.
      ...plain([
        'snapdom(element)',
        'toCanvas(element)',
        'CanvasCrop.x',
        'CanvasCrop.y',
        'CanvasCrop.width',
        'CanvasCrop.height',
        'SnapdomOptions.dpr',
      ]),
      'toCanvas(options)': 'options',
      'CaptureResult.toCanvas(options)': 'options',
      'CanvasExportOptions.crop': 'options',
    },
  },
  // Routing: paths, navigation options, route elements and a NavLink's class name.
  'react-router': {
    keys: plain([
      // Navigation options and the router object `createBrowserRouter` makes.
      'NavigateOptions.defaultShouldRevalidate',
      'NavigateOptions.mask',
      'NavigateOptions.preventScrollReset',
      'NavigateOptions.relative',
      'NavigateOptions.viewTransition',
      'Router._internalFetchControllers',
      'Router._internalSetRoutes',
      'Router._internalSetStateDoNotUseOrYouWillBreakYourApp',
      'Router.basename',
      'Router.createHref',
      'Router.createURL',
      'Router.deleteBlocker',
      'Router.deleteFetcher',
      'Router.dispose',
      'Router.enableScrollRestoration',
      'Router.encodeLocation',
      'Router.fetch',
      'Router.future',
      'Router.getBlocker',
      'Router.getFetcher',
      'Router.initialize',
      'Router.manifest',
      'Router.match',
      'Router.navigate',
      'Router.patchRoutes',
      'Router.resetFetcher',
      'Router.revalidate',
      'Router.routes',
      'Router.state',
      'Router.subscribe',
      'Router.window',
      'BaseRouteObject.Component',
      'BaseRouteObject.ErrorBoundary',
      'BaseRouteObject.element',
      'BaseRouteObject.errorElement',
      'BaseRouteObject.path',
      'LinkProps.replace',
      'LinkProps.to',
      'MemoryRouterProps.initialEntries',
      'NavLinkProps.className',
      'NavLinkProps.end',
      'NavigateFunction(delta)',
      'NavigateFunction(options)',
      'NavigateFunction(to)',
      'NavigateOptions.flushSync',
      'NavigateOptions.replace',
      'NavigateOptions.state',
      'NavigateProps.replace',
      'NavigateProps.to',
      'NonIndexRouteObject.children',
      'NonIndexRouteObject.index',
      'PathRouteProps.element',
      'PathRouteProps.path',
      'Router.subscribe(fn)',
      'RouterProviderProps.router',
      'SetURLSearchParams(navigateOpts)',
      'SetURLSearchParams(nextInit)',
      'isRouteErrorResponse(error)',
    ]),
  },
  '@ark-ui/react': {
    keys: plain(['RenderStrategyProps.lazyMount', 'RenderStrategyProps.unmountOnExit']),
  },
  '@zag-js/dialog': {
    keys: plain([
      'DialogProps.closeOnEscape',
      'DialogProps.closeOnInteractOutside',
      'DialogProps.onOpenChange',
      'DialogProps.open',
      'DialogProps.role',
    ]),
  },
  '@zag-js/dismissable': {
    keys: plain([
      'DismissableElementHandlers.onEscapeKeyDown',
      'DismissableElementHandlers.onRequestDismiss',
    ]),
  },
  '@zag-js/interact-outside': { keys: plain(['InteractOutsideHandlers.onInteractOutside']) },
  '@zag-js/tabs': {
    keys: plain([
      'ContentProps.value',
      'TabsProps.activationMode',
      'TabsProps.onValueChange',
      'TabsProps.value',
      'TriggerProps.value',
    ]),
  },
  '@zag-js/color-picker': {
    keys: {
      // The picker paints its swatches from this colour.
      'parse(colorString)': 'color',
      // A colour made by `parseColor`, whose string is judged there.
      ...plain([
        'ChannelProps.channel',
        'ColorPickerProps.defaultValue',
        'ColorPickerProps.inline',
        'ColorPickerProps.onValueChangeEnd',
      ]),
    },
  },
  '@zag-js/qr-code': { keys: plain(['QrCodeProps.encoding', 'QrCodeProps.value']) },
});

/** What `pkg` does with `name` (`PACKAGE_PROPS`), undefined when not registered. */
export const packageProp = (pkg, name) =>
  PACKAGE_PROPS[pkg]?.all ?? PACKAGE_PROPS[pkg]?.keys?.[name];

/**
 * What `width`/`height` mean on each element that takes them as attributes, keyed by tag with
 * the element's DOM interface and React attribute interface, so a JSX attribute, a DOM write and
 * a component prop that lands on the element read one answer (P1 QA17 S1). `box` sizes the
 * element's box: a style value, judged in the size domain. `bitmap` is a canvas bitmap's
 * resolution in pixels (CSS sizes its box), content rather than style (P1 QA16 F2). An element
 * not listed takes no `width`/`height` attribute in JSX; written through the DOM or a component
 * prop where the element is not known, they are judged as `box`.
 */
export const SIZE_HOSTS = Object.freeze(
  new Map([
    ['iframe', { meaning: 'box', element: 'HTMLIFrameElement', react: 'IframeHTMLAttributes' }],
    ['img', { meaning: 'box', element: 'HTMLImageElement', react: 'ImgHTMLAttributes' }],
    ['svg', { meaning: 'box', element: 'SVGSVGElement', react: 'SVGAttributes' }],
    ['canvas', { meaning: 'bitmap', element: 'HTMLCanvasElement', react: 'CanvasHTMLAttributes' }],
  ]),
);

// ---------------------------------------------------------------------------------------------
// DOM write entry points (§2 E5)
// ---------------------------------------------------------------------------------------------

/**
 * Members of the managed DOM interfaces any file may reference (methods) or write (properties):
 * none of them creates or attaches a node, parses markup or CSS, or writes an attribute or a
 * style. Bare names match the member on every managed interface; `Interface.member` matches one.
 */
export const DOM_ALLOW = Object.freeze(
  new Set([
    // Events, lookup and measurement.
    'addEventListener',
    'removeEventListener',
    'querySelector',
    'querySelectorAll',
    'getElementById',
    'closest',
    'matches',
    'contains',
    'compareDocumentPosition',
    'getRootNode',
    'getAttribute',
    'hasAttribute',
    'getBoundingClientRect',
    // Focus, pointer capture, scrolling and dialogs.
    'focus',
    'blur',
    'click',
    'select',
    'setPointerCapture',
    'releasePointerCapture',
    'hasPointerCapture',
    'scrollTo',
    'scrollBy',
    'scrollIntoView',
    'Element.scrollTop',
    'Element.scrollLeft',
    'showModal',
    'close',
    // Form values.
    'HTMLInputElement.value',
    'HTMLInputElement.indeterminate',
    // Canvas pixels and image decoding.
    'getContext',
    'toBlob',
    'toDataURL',
    'decode',
    'HTMLCanvasElement.width',
    'HTMLCanvasElement.height',
    'HTMLImageElement.src',
    'HTMLImageElement.fetchPriority',
    // Media playback.
    'load',
    'pause',
    'play',
    'HTMLMediaElement.src',
    'HTMLMediaElement.currentTime',
    'HTMLMediaElement.volume',
    'HTMLMediaElement.loop',
    'HTMLMediaElement.preload',
    'HTMLMediaElement.crossOrigin',
    'HTMLMediaElement.muted',
    'GlobalEventHandlers.oncanplaythrough',
    'GlobalEventHandlers.onended',
    'GlobalEventHandlers.onerror',
    // Web Animations playback control (not creation).
    'Animation.cancel',
    'Animation.currentTime',
    // Read-only constants.
    'HTMLMediaElement.HAVE_ENOUGH_DATA',
    'Node.DOCUMENT_POSITION_FOLLOWING',
  ]),
);

/** Products of element factories (`createElement`, `new Image()`) any file may create. */
export const SAFE_PRODUCTS = Object.freeze(
  new Set(['HTMLCanvasElement', 'HTMLImageElement', 'HTMLAudioElement', 'HTMLAnchorElement']),
);

/**
 * Files allowed to use other managed members, member by member. For the attribute and property
 * writers (`setAttribute`, `removeAttribute`, `setProperty`, `removeProperty`) an entry names
 * the attribute or property too (`setAttribute:opacity`); a trailing `*` (`setProperty:--color-*`)
 * registers a publisher of a token family, matched against the name's template literal type. Factories with another product register `createElement:<tag>` or
 * `new <Constructor>`.
 */
export const DOM_WRITERS = Object.freeze({
  'packages/web/src/boot/bootSplash.ts': [
    'CSSStyleProperties.transform',
    'DOMStringMap.__index',
    'Element.textContent',
    'HTMLElement.hidden',
    'setAttribute:aria-valuenow',
  ],
  'packages/web/src/boot/dismissBootSplash.ts': ['ChildNode.remove', 'DOMTokenList.add'],
  'packages/web/src/boot/runtimeEnvironment.ts': [
    'HTMLScriptElement.src',
    'ParentNode.append',
    'createElement:script',
  ],
  'packages/web/src/config/avatarShape.ts': ['setProperty:--avatar-corner-ratio'],
  'packages/web/src/features/gacha/machine/CapsuleMachine.tsx': ['CSSStyleProperties.transform'],
  'packages/web/src/features/room/components/GalleryAlbumStage.tsx': ['CSSStyleProperties.height'],
  'packages/web/src/features/room/components/RoleRevealEffects/common/AtmosphericBackground.tsx': [
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/common/RevealCardFace.tsx': [
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/ChainShatter.tsx': [
    'setAttribute:cx',
    'setAttribute:cy',
    'setAttribute:opacity',
    'setAttribute:r',
    'setAttribute:transform',
    'setAttribute:x1',
    'setAttribute:x2',
    'setAttribute:y1',
    'setAttribute:y2',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/FateDecree.tsx': [
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/MythicCollectionReveal.tsx':
    ['CSSStyleProperties.opacity', 'setAttribute:opacity', 'setAttribute:transform'],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/RoleHunt.tsx': [
    'setAttribute:cx',
    'setAttribute:cy',
    'setAttribute:opacity',
    'setAttribute:r',
    'setAttribute:transform',
    'setAttribute:x2',
    'setAttribute:y2',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/ScratchReveal.tsx': [
    'CSSStyleProperties.width',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/SealBreak.tsx': [
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
    'Element.textContent',
    'setAttribute:cx',
    'setAttribute:cy',
    'setAttribute:opacity',
    'setAttribute:stroke-dasharray',
    'setAttribute:transform',
    'setAttribute:visibility',
    'setAttribute:x',
    'setAttribute:y',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/effects/TarotDraw.tsx': [
    'setAttribute:cy',
    'setAttribute:opacity',
    'setAttribute:r',
    'setAttribute:transform',
  ],
  'packages/web/src/features/room/components/RoleRevealEffects/runtime.ts': [
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
  ],
  'packages/web/src/features/room/services/shareImage.ts': [
    'ChildNode.remove',
    'HTMLAnchorElement.download',
    'HTMLHyperlinkElementUtils.href',
    'Node.appendChild',
  ],
  'packages/web/src/games/decrypto/room/DecryptoTeamSetup.tsx': ['setAttribute:closedby'],
  'packages/web/src/games/spotmatch/room/hooks/useSpotmatchCardFlight.ts': [
    'Animatable.animate',
    'CSSStyleProperties.width',
  ],
  'packages/web/src/main.tsx': ['Element.textContent'],
  'packages/web/src/routes/admin/AdminShell.tsx': ['setProperty:--admin-workspace-header-height'],
  'packages/web/src/routes/bench/SceneBench.tsx': ['DOMStringMap.__index'],
  'packages/web/src/scene/SeatEntrance.tsx': [
    'CSSStyleProperties.clipPath',
    'CSSStyleProperties.opacity',
    'CSSStyleProperties.transform',
    'Node.cloneNode',
    'ParentNode.replaceChildren',
    'removeProperty:clip-path',
    'removeProperty:opacity',
    'removeProperty:transform',
  ],
  'packages/web/src/scene/stage.ts': [
    'ChildNode.remove',
    'DOMTokenList.add',
    'ParentNode.append',
    'setAttribute:aria-hidden',
  ],
  'packages/web/src/services/infra/audio/BgmPlayer.ts': ['removeAttribute:src'],
  'packages/web/src/services/infra/audio/WebAudioStrategy.ts': ['removeAttribute:src'],
  'packages/web/src/theme/colors.ts': RUNTIME_TOKEN_FAMILIES.map(
    (family) => `setProperty:${family}*`,
  ),
});

// ---------------------------------------------------------------------------------------------
// Lists that decide what the rules manage and accept (moved here from eslint-plugin.mjs and
// values.mjs so every allow list is pinned by the registry snapshot, P1 QA7 S2).
// ---------------------------------------------------------------------------------------------

/** Interfaces outside the node hierarchy whose members also write markup, styles or nodes. */
export const STYLE_INTERFACES = Object.freeze([
  'CSSStyleDeclaration',
  'CSSStyleProperties',
  'CSSRule',
  'CSSRuleList',
  'CSSStyleSheet',
  'StyleSheet',
  'StyleSheetList',
  'MediaList',
  'StylePropertyMap',
  'StylePropertyMapReadOnly',
  'DOMTokenList',
  'DOMStringMap',
  'NamedNodeMap',
  'Range',
  'AbstractRange',
  'Selection',
  'DOMParser',
  'XMLSerializer',
  'FontFace',
  'FontFaceSet',
  'CustomElementRegistry',
  'ElementInternals',
  'Animation',
  'KeyframeEffect',
  'AnimationEffect',
  'CSS',
]);
export const ROOT_INTERFACES = Object.freeze([
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'MathMLElement',
  'Document',
  'DocumentFragment',
  'ShadowRoot',
  'Text',
  'Comment',
  'Attr',
  'CharacterData',
]);
export const TAG_MAPS = Object.freeze([
  'HTMLElementTagNameMap',
  'SVGElementTagNameMap',
  'MathMLElementTagNameMap',
]);
/** Event dispatch is shared with non-DOM objects and writes nothing. */
export const UNMANAGED = Object.freeze(new Set(['EventTarget']));
export const FACTORIES = Object.freeze(new Set(['createElement', 'createElementNS']));
export const NAMED_WRITERS = Object.freeze(
  new Set([
    'setAttribute',
    'removeAttribute',
    'toggleAttribute',
    'setAttributeNS',
    'setProperty',
    'removeProperty',
  ]),
);
export const REFLECTION = Object.freeze({
  ObjectConstructor: new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf']),
  Reflect: new Set(['set', 'defineProperty', 'apply', 'construct', 'setPrototypeOf']),
});

/** React's two names for raw HTML: the prop and the key of its value. */
/** Props that hand React raw HTML: `srcDoc` is a whole document (P1 QA11 F5). */
export const HTML_KEYS = Object.freeze(new Set(['dangerouslySetInnerHTML', '__html', 'srcDoc']));
export const MATH = Object.freeze(new Set(['calc', 'min', 'max', 'clamp']));
export const OPERATORS = Object.freeze(new Set(['+', '-', '*', '/']));
/** Color atoms besides `var()`: every domain that holds a color accepts them. */
export const COLOR_KEYWORDS = Object.freeze(new Set(['transparent', 'currentcolor']));
/** Functions whose arguments are references, not values: `url()` only (`env()` has a fallback). */
export const REFERENCES = Object.freeze(new Set(['url']));
/** `animation` keywords; any other identifier there names a keyframes rule. */
export const ANIMATION_KEYWORDS = Object.freeze(
  new Set([
    'infinite',
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'step-start',
    'step-end',
    'normal',
    'reverse',
    'alternate',
    'alternate-reverse',
    'none',
    'forwards',
    'backwards',
    'both',
    'running',
    'paused',
  ]),
);
export const ANIMATION_NAMES = Object.freeze(new Set(['animation', 'animation-name']));

/** `import.meta.glob` shapes the bundle graph expands exactly (P1 QA7 F3, QA8 FIX-FIRST-1). */
export const GLOB_OPTIONS = Object.freeze(new Set(['eager', 'import', 'query']));
export const GLOB_PATH = /^(?:@\/|\/|\.{1,2}\/)?[\w./-]*$/;
export const GLOB_NAME = /^[\w.*-]+$/;
export const GLOB_BRACE = /^[\w.*-]+(?:,[\w.*-]+)+$/;

/** Scripts the graph follows, and declaration files it never does. */
export const SCRIPT_FILE = /\.(?:ts|tsx)$/;
export const DECLARATION_FILE = /\.d\.ts$/;
/** Constructors that start a module graph of their own (`new Worker(new URL(…))`). */
export const WORKER_CONSTRUCTORS = Object.freeze(new Set(['Worker', 'SharedWorker']));
/** The only `react-dom/client` export the app may import (E11). */
export const REACT_DOM_CLIENT_IMPORTS = Object.freeze(['createRoot']);
/** The attributes whose meaning `SIZE_HOSTS` gives per element (E4). */
export const SIZE_ATTRIBUTES = Object.freeze(new Set(['width', 'height']));

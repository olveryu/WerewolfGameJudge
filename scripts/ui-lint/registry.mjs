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

/** File types a module may import as an asset (only the `?url` query is allowed). */
export const ASSET_EXTENSIONS = Object.freeze(
  new Set(['png', 'webp', 'svg', 'json', 'mp3', 'm4a']),
);
export const ASSET_QUERIES = Object.freeze(new Set(['', '?url']));
/** Virtual modules a Vite plugin serves. */
export const VIRTUAL_MODULE_PREFIXES = Object.freeze(['~icons/']);

/**
 * Third-party packages the bundle may import (by script entry; package stylesheets never), each
 * with the manifest field it must be declared in and what it brings to the page. A package the
 * web manifest declares in `dependencies` and does not register here, or a registered package
 * the manifest does not declare in that field, is a graph problem. A package with `entries`
 * may be imported only by those specifiers.
 */
export const PACKAGES = Object.freeze({
  '@ark-ui/react': { field: 'dependencies', why: 'headless components; styles come from us' },
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

/**
 * Art stylesheets (plan D7): their values are the artwork, so the value rules are off, and every
 * class in every selector carries the sheet's prefix (`prefix`, `prefix-*` or `prefix__*`).
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

/** Layout ratios a size, offset or track may use as literals: they are not design sizes. */
const RATIO_UNITS = ['%', 'vw', 'vh', 'dvw', 'dvh', 'svw', 'svh', 'lvw', 'lvh'];
const SIZE_KEYWORDS = ['auto', 'none', 'fit-content', 'min-content', 'max-content', 'stretch'];
const POSITION_KEYWORDS = ['center', 'top', 'bottom', 'left', 'right'];

/**
 * Token domains. A value in a domain is a sequence of atoms: `var()` (its fallback read in the
 * same domain), a global keyword, zero, a domain keyword, a domain literal, or a math function
 * over atoms where the only bare number is the sign flip `-1`. `units` lists the literal units a
 * domain accepts (layout ratios, angles), also inside math; `unitless` accepts plain numbers
 * outside math (counts, factors, flex weights); `idents` accepts custom identifiers (animation
 * and property names); `literals` lists exact words (opacity `1`). The arguments of `url()` and
 * `env()` are references, not values.
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
    unitless: true,
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
    unitless: true,
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
  /** `clip-path`: shapes are free, except the corner radius after `round` (radius domain). */
  shape: { shape: true },
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
      'clip',
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
    'iframe',
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

// ---------------------------------------------------------------------------------------------
// Inline styles and SVG presentation attributes (§2 E4)
// ---------------------------------------------------------------------------------------------

/** Style keys React writes as plain numbers; any other number gets `px` (React's own list). */
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

/** SVG presentation attributes (JSX name) and the CSS property whose domain judges them. */
export const SVG_ATTRIBUTES = Object.freeze(
  new Map([
    ['fill', 'fill'],
    ['stroke', 'stroke'],
    ['color', 'color'],
    ['stopColor', 'stop-color'],
    ['floodColor', 'flood-color'],
    ['strokeWidth', 'stroke-width'],
    ['opacity', 'opacity'],
    ['fillOpacity', 'fill-opacity'],
    ['strokeOpacity', 'stroke-opacity'],
    ['stopOpacity', 'stop-opacity'],
    ['rx', 'border-radius'],
    ['ry', 'border-radius'],
    ['fontSize', 'font-size'],
    ['fontWeight', 'font-weight'],
    ['fontFamily', 'font-family'],
    ['letterSpacing', 'letter-spacing'],
  ]),
);

/** Elements whose `width`/`height` attributes size their box, judged in the size domain. */
export const SIZED_ELEMENTS = Object.freeze(new Set(['canvas', 'iframe', 'img', 'svg']));

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

/** Template index keys a props or style type may carry: custom properties, data and ARIA. */
export const OPEN_KEY_HEADS = Object.freeze(new Set(['--', 'data-', 'aria-']));
/** React's two names for raw HTML: the prop and the key of its value. */
export const HTML_KEYS = Object.freeze(new Set(['dangerouslySetInnerHTML', '__html']));
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

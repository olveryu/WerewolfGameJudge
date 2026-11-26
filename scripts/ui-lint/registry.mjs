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

// ---------------------------------------------------------------------------------------------
// CSS (§2 S1, S2, S4, S7, S10)
// ---------------------------------------------------------------------------------------------

/** The token stylesheet: only custom property definitions, under these selectors. */
export const TOKEN_SHEET = Object.freeze({
  file: 'packages/web/src/theme/tokens.css',
  selectors: Object.freeze(['.admin-console', ':root']),
});

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

/**
 * Token domains. A value in a domain is a sequence of atoms: `var()` (its fallback read in the
 * same domain), a global keyword, zero, a domain keyword, or a math function over atoms where the
 * only number is the sign flip `-1`. `units` lists the extra literal units a domain accepts
 * (percentages and angles in paint), `unitless` accepts plain numbers (iteration counts, filter
 * amounts, scale factors), `idents` accepts custom identifiers (animation and property names).
 */
export const DOMAINS = Object.freeze({
  radius: { keywords: [] },
  spacing: { keywords: ['auto'], functions: ['env'] },
  font: { keywords: ['normal'] },
  layer: { keywords: ['auto'] },
  'line-width': { keywords: [] },
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
  paint: {
    keywords: [
      'none',
      'auto',
      'no-repeat',
      'repeat',
      'repeat-x',
      'repeat-y',
      'center',
      'top',
      'bottom',
      'left',
      'right',
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
  /** A custom property definition outside the token sheet (S4): references and scale factors. */
  custom: { keywords: [], colors: true, unitless: true, mathNumbers: true, functions: ['env'] },
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
 * domain, or `free` for properties whose value syntax holds no color and no design size
 * (layout, positioning, transforms, behaviour). An unregistered property is reported.
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
      'fill',
      'stroke',
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
      'flex',
      'flex-basis',
      'flex-direction',
      'flex-flow',
      'flex-grow',
      'flex-shrink',
      'flex-wrap',
      'order',
      'grid-area',
      'grid-column',
      'grid-row',
      'grid-template',
      'grid-template-areas',
      'grid-template-columns',
      'grid-template-rows',
      'grid-auto-flow',
      'grid-auto-columns',
      'grid-auto-rows',
      'position',
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
      'object-position',
      'opacity',
      'visibility',
      'pointer-events',
      'cursor',
      'user-select',
      'touch-action',
      'transform',
      'transform-origin',
      'transform-style',
      'translate',
      'rotate',
      'scale',
      'perspective',
      'perspective-origin',
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
      'vertical-align',
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
      'stroke-dasharray',
      'stroke-dashoffset',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-width',
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
 * the attribute or property too (`setAttribute:opacity`); `setProperty:*` registers a publisher
 * of a whole token family. Factories with another product register `createElement:<tag>` or
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
  'packages/web/src/theme/colors.ts': ['setProperty:*'],
});

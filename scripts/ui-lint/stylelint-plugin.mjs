/**
 * Local Stylelint rules for the web client's UI gate (rule IDs refer to the UI drift lock plan).
 *
 * - `ui/strict-value` (S1): size, type, shape, depth and timing properties take only `var()`.
 * - `ui/no-local-literal-custom-property` (S4): outside the token stylesheet, a custom property
 *   is never defined as a literal S1 would reject (a length, time, or named size, weight, border
 *   width or system font) and `@property` registers nothing, so no local variable or registered
 *   initial value carries such a literal past S1. Unitless local numbers stay legal; which
 *   variables a value may reference at all is S3's job. S1 and S4 read tokens through the same
 *   `literalKind()`, so "what counts as a literal" is defined once.
 * - `ui/no-system-color` (S2): system colors (`Canvas`, `ButtonText`, …) are color literals that
 *   `color-named` does not know. They are the required values inside exactly
 *   `@media (forced-colors: active)`, where the browser replaces every author color, and are
 *   rejected everywhere else.
 * - `ui/no-css-escapes` (S7): property names, selectors, values and at-rule parameters carry no
 *   CSS escapes, so no escaped spelling can hide a property, class or unit from the other rules.
 *
 * Every check fails closed: a function is unpacked unless it is known to hold no S1 value, a
 * number inside a math function is a picked value (only the sign flip `-1` is arithmetic), and
 * vendor-prefixed property and function names are read without their prefix. Other color
 * literals are checked by `color-no-hex`, `color-named` and `function-disallowed-list` on every
 * property (S2, `stylelint.config.mjs`).
 */
import stylelint from 'stylelint';
import valueParser from 'postcss-value-parser';

const {
  createPlugin,
  utils: { report, ruleMessages },
} = stylelint;

/** Keywords that pick no value of their own: they reset, inherit, or defer to layout. */
const NEUTRAL_KEYWORDS = new Set([
  'auto',
  'none',
  'normal',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const REFERENCE_FUNCTIONS = new Set(['var', 'env']);
/**
 * Functions that hold no S1 value: colors (S2's domain), images and easing curves. Every other
 * function — calc(), min(), round(), abs(), clamp() and any future math function — is unpacked.
 */
const OPAQUE_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
  'light-dark',
  'url',
  'image-set',
  'linear-gradient',
  'radial-gradient',
  'conic-gradient',
  'repeating-linear-gradient',
  'repeating-radial-gradient',
  'repeating-conic-gradient',
  'cubic-bezier',
  'steps',
  'linear',
]);
const TIME_UNITS = new Set(['s', 'ms']);
const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;

/** Named values by kind; `medium` names both a font size and a border width. */
const KEYWORD_KINDS = new Map([
  ...['thin', 'thick'].map((word) => [word, 'border-width']),
  ...['bold', 'bolder', 'lighter'].map((word) => [word, 'weight']),
  ...[
    'xx-small',
    'x-small',
    'small',
    'medium',
    'large',
    'x-large',
    'xx-large',
    'xxx-large',
    'smaller',
    'larger',
  ].map((word) => [word, 'size']),
  // System fonts set size and weight at once (`font: caption`).
  ...['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'].map((word) => [
    word,
    'system-font',
  ]),
]);

/**
 * What kind of literal a word is: `number` (unitless), `time`, `dimension` (any other unit, or
 * %), a keyword kind from KEYWORD_KINDS, or `undefined` for a neutral keyword, zero, a hex color
 * (S2's domain) or an identifier that names no value. The single definition S1 and S4 share.
 */
export function literalKind(word) {
  const lower = word.toLowerCase();
  if (NEUTRAL_KEYWORDS.has(lower) || word.startsWith('#')) return undefined;
  const number = valueParser.unit(word);
  if (number) {
    if (Number(number.number) === 0) return undefined;
    const unit = number.unit.toLowerCase();
    if (unit === '') return 'number';
    return TIME_UNITS.has(unit) ? 'time' : 'dimension';
  }
  return KEYWORD_KINDS.get(lower);
}

/**
 * How each checked property reads its value — which literal kinds are picked values there:
 * - `scalar`: every literal and every other identifier (lengths, radii, spacing, named sizes);
 * - `unitless`: the same, for properties whose values are plain numbers (z-index, line height);
 * - `weight`: numbers and weight keywords;
 * - `font`: the `font` shorthand — numbers, dimensions, size, weight and system-font keywords;
 *   family names are structure;
 * - `shadow`: numbers and dimensions; colors belong to S2; `inset` is structure;
 * - `border`: numbers, dimensions and width keywords; styles are structure;
 * - `motion`: times only; property names, easings, names and iteration counts are structure;
 * - `variation`: anything but `var()` and neutral keywords (`font-variation-settings: 'wght' 650`
 *   is a font weight).
 * Inside a math function every number is a picked value in every mode except the sign flip `-1`:
 * `calc(var(--radius-small) * 1.625)` picks 13px as surely as `13px` does.
 */
const SIDES = '(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?';
const MODES = [
  [/^font-size$/, 'scalar'],
  [/^line-height$/, 'unitless'],
  [/^font-weight$/, 'weight'],
  [/^font$/, 'font'],
  [/^font-variation-settings$/, 'variation'],
  [/^letter-spacing$/, 'scalar'],
  [/^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/, 'scalar'],
  [/^z-index$/, 'unitless'],
  [new RegExp(`^(?:padding|margin)${SIDES}$`), 'scalar'],
  [/^(?:grid-)?(?:gap|row-gap|column-gap)$/, 'scalar'],
  [new RegExp(`^border${SIDES}-width$`), 'scalar'],
  [new RegExp(`^border${SIDES}$`), 'border'],
  [/^outline-width$/, 'scalar'],
  [/^outline-offset$/, 'scalar'],
  [/^outline$/, 'border'],
  [/^(?:box|text)-shadow$/, 'shadow'],
  [/^(?:transition|animation)(?:-(?:duration|delay))?$/, 'motion'],
];

/** Literal kinds each mode rejects outside math functions (scalar/unitless: every identifier). */
const PICKED_KINDS = {
  weight: new Set(['number', 'weight']),
  font: new Set(['number', 'dimension', 'time', 'size', 'weight', 'system-font']),
  shadow: new Set(['number', 'dimension', 'time']),
  border: new Set(['number', 'dimension', 'time', 'border-width', 'size']),
  motion: new Set(['time']),
};
/** The one number a math function may hold: a sign flip picks no magnitude. */
const ARITHMETIC_NUMBERS = new Set([-1]);

function unprefixed(name) {
  return name.toLowerCase().replace(VENDOR_PREFIX, '');
}

function modeOf(prop) {
  const name = unprefixed(prop);
  for (const [pattern, mode] of MODES) if (pattern.test(name)) return mode;
  return undefined;
}

/** The nodes after the first comma of var()/env(): the fallback, a value like any other. */
function fallbackOf(node) {
  const comma = node.nodes.findIndex((child) => child.type === 'div' && child.value === ',');
  return comma === -1 ? [] : node.nodes.slice(comma + 1);
}

/** Returns the literal tokens in `nodes` that a property in `mode` may not carry. */
function literalTokens(nodes, mode, inMath) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = unprefixed(node.value);
      if (REFERENCE_FUNCTIONS.has(name)) {
        found.push(...literalTokens(fallbackOf(node), mode, inMath));
      } else if (!OPAQUE_FUNCTIONS.has(name)) {
        found.push(...literalTokens(node.nodes, mode, true));
      } else if (mode === 'variation') {
        found.push(valueParser.stringify(node));
      }
      continue;
    }
    if (mode === 'variation') {
      if (node.type === 'string') found.push(valueParser.stringify(node));
      else if (node.type === 'word' && !NEUTRAL_KEYWORDS.has(node.value.toLowerCase()))
        found.push(node.value);
      continue;
    }
    if (node.type !== 'word') continue;
    const word = node.value;
    const kind = literalKind(word);
    if (inMath) {
      // Identifiers inside functions are keywords of the function (round(up, …)).
      if (kind === 'number' && ARITHMETIC_NUMBERS.has(Number(word))) continue;
      if (kind === 'number' || kind === 'dimension' || kind === 'time') {
        if (mode !== 'motion' || kind !== 'dimension') found.push(word);
      }
      continue;
    }
    if (mode === 'scalar' || mode === 'unitless') {
      // Named sizes (small, larger, thin…) pick a value; any other identifier here does too.
      const zero = kind === undefined && Number(valueParser.unit(word)?.number) === 0;
      if (!NEUTRAL_KEYWORDS.has(word.toLowerCase()) && !word.startsWith('#') && !zero) {
        found.push(word);
      }
      continue;
    }
    if (kind !== undefined && PICKED_KINDS[mode].has(kind)) found.push(word);
  }
  return found;
}

const strictValueName = 'ui/strict-value';
const strictValueMessages = ruleMessages(strictValueName, {
  rejected: (prop, token) =>
    `Use a token var() for "${prop}" instead of the literal "${token}" (UI gate S1).`,
});

const strictValue = createPlugin(strictValueName, (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) return;
    const mode = modeOf(decl.prop);
    if (mode === undefined) return;
    for (const token of literalTokens(valueParser(decl.value).nodes, mode, false)) {
      report({
        ruleName: strictValueName,
        result,
        node: decl,
        word: token,
        message: strictValueMessages.rejected(decl.prop, token),
      });
    }
  });
});
strictValue.ruleName = strictValueName;
strictValue.messages = strictValueMessages;

const localLiteralName = 'ui/no-local-literal-custom-property';
const localLiteralMessages = ruleMessages(localLiteralName, {
  rejected: (prop, token) =>
    `Custom property "${prop}" defines the literal "${token}"; style values live in theme/tokens.css (UI gate S4).`,
  registered: (params) =>
    `@property ${params} registers a local initial value; style values live in theme/tokens.css (UI gate S4).`,
});

/** Literals in a custom property value: every kind S1 rejects except unitless numbers. */
function customPropertyLiterals(nodes) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = unprefixed(node.value);
      if (REFERENCE_FUNCTIONS.has(name)) found.push(...customPropertyLiterals(fallbackOf(node)));
      else if (!OPAQUE_FUNCTIONS.has(name)) found.push(...customPropertyLiterals(node.nodes));
      continue;
    }
    if (node.type !== 'word') continue;
    const kind = literalKind(node.value);
    if (kind !== undefined && kind !== 'number') found.push(node.value);
  }
  return found;
}

const localLiteral = createPlugin(localLiteralName, (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith('--')) return;
    for (const token of customPropertyLiterals(valueParser(decl.value).nodes)) {
      report({
        ruleName: localLiteralName,
        result,
        node: decl,
        word: token,
        message: localLiteralMessages.rejected(decl.prop, token),
      });
    }
  });
  // A registered property's initial-value is a local literal by another name.
  root.walkAtRules((atRule) => {
    if (unprefixed(atRule.name) !== 'property') return;
    report({
      ruleName: localLiteralName,
      result,
      node: atRule,
      message: localLiteralMessages.registered(atRule.params),
    });
  });
});
localLiteral.ruleName = localLiteralName;
localLiteral.messages = localLiteralMessages;

const systemColorName = 'ui/no-system-color';
const systemColorMessages = ruleMessages(systemColorName, {
  rejected: (prop, token) =>
    `"${token}" in "${prop}" is a system color literal; use a --color-* token (UI gate S2).`,
});

/** CSS Color 4 system colors and the deprecated CSS2 ones browsers still render. */
const SYSTEM_COLORS = new Set(
  [
    'AccentColor',
    'AccentColorText',
    'ActiveText',
    'ButtonBorder',
    'ButtonFace',
    'ButtonText',
    'Canvas',
    'CanvasText',
    'Field',
    'FieldText',
    'GrayText',
    'Highlight',
    'HighlightText',
    'LinkText',
    'Mark',
    'MarkText',
    'SelectedItem',
    'SelectedItemText',
    'VisitedText',
    'ActiveBorder',
    'ActiveCaption',
    'AppWorkspace',
    'Background',
    'ButtonHighlight',
    'ButtonShadow',
    'CaptionText',
    'InactiveBorder',
    'InactiveCaption',
    'InactiveCaptionText',
    'InfoBackground',
    'InfoText',
    'Menu',
    'MenuText',
    'Scrollbar',
    'ThreeDDarkShadow',
    'ThreeDFace',
    'ThreeDHighlight',
    'ThreeDLightShadow',
    'ThreeDShadow',
    'Window',
    'WindowFrame',
    'WindowText',
  ].map((name) => name.toLowerCase()),
);
/**
 * Properties whose identifiers can be colors. Names elsewhere (grid areas, animation names,
 * font families) are structure that may legitimately spell `Menu` or `Field`.
 */
const COLOR_PROPERTY =
  /(?:^|-)color$|^(?:background|border(?:-.+)?|outline|fill|stroke|(?:box|text)-shadow|text-decoration|text-emphasis|column-rule|scrollbar-color|--.+)$/;

/** System color words in `nodes`, unpacking every function (a color can hide in any of them). */
function systemColors(nodes) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = unprefixed(node.value);
      found.push(...systemColors(REFERENCE_FUNCTIONS.has(name) ? fallbackOf(node) : node.nodes));
    } else if (node.type === 'word' && SYSTEM_COLORS.has(node.value.toLowerCase())) {
      found.push(node.value);
    }
  }
  return found;
}

/**
 * True inside `@media (forced-colors: active)` written exactly so (any case and spacing): a query
 * list or `or`/`not` condition could also match outside forced-colors mode.
 */
function inForcedColors(node) {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media') {
      return parent.params.replace(/\s+/g, '').toLowerCase() === '(forced-colors:active)';
    }
  }
  return false;
}

const noSystemColor = createPlugin(systemColorName, (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    if (inForcedColors(decl)) return;
    const prop = decl.prop.startsWith('--') ? decl.prop : unprefixed(decl.prop);
    if (!COLOR_PROPERTY.test(prop)) return;
    for (const token of systemColors(valueParser(decl.value).nodes)) {
      report({
        ruleName: systemColorName,
        result,
        node: decl,
        word: token,
        message: systemColorMessages.rejected(decl.prop, token),
      });
    }
  });
});
noSystemColor.ruleName = systemColorName;
noSystemColor.messages = systemColorMessages;

const escapesName = 'ui/no-css-escapes';
const escapesMessages = ruleMessages(escapesName, {
  rejected: (where) => `CSS escapes are not allowed in ${where} (UI gate S7).`,
});

/** True when a value has a backslash outside quoted strings (strings may escape characters). */
function valueHasEscape(value) {
  let escaped = false;
  valueParser(value).walk((node) => {
    if (node.type !== 'string' && node.value.includes('\\')) escaped = true;
  });
  return escaped;
}

const noCssEscapes = createPlugin(escapesName, (enabled) => (root, result) => {
  if (!enabled) return;
  const reject = (node, where) =>
    report({ ruleName: escapesName, result, node, message: escapesMessages.rejected(where) });
  root.walkDecls((decl) => {
    if (decl.prop.includes('\\')) reject(decl, 'a property name');
    else if (valueHasEscape(decl.value)) reject(decl, 'a value');
  });
  root.walkRules((rule) => {
    if (rule.selector.includes('\\')) reject(rule, 'a selector');
  });
  root.walkAtRules((atRule) => {
    if (valueHasEscape(atRule.params)) reject(atRule, 'at-rule parameters');
  });
});
noCssEscapes.ruleName = escapesName;
noCssEscapes.messages = escapesMessages;

export default [strictValue, localLiteral, noSystemColor, noCssEscapes];

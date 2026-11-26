/**
 * Local Stylelint rules for the web client's UI gate (rule IDs refer to the UI drift lock plan).
 *
 * - `ui/strict-value` (S1): size, type, shape, depth and timing properties take only `var()`.
 * - `ui/no-local-literal-custom-property` (S4): outside the token stylesheet, a custom property
 *   is never defined as a raw length, time or named size/weight, so a local variable cannot carry
 *   such a literal past S1. (Unitless local numbers stay legal — scale factors are arithmetic;
 *   which variables a value may reference at all is S3's job.)
 * - `ui/no-css-escapes` (S7): property names, selectors, values and at-rule parameters carry no
 *   CSS escapes, so no escaped spelling can hide a property, class or unit from the other rules.
 *
 * Every check fails closed: a function is unpacked unless it is known to hold no S1 value, and
 * vendor-prefixed property and function names are read without their prefix. Color literals are
 * not checked here: `color-no-hex`, `color-named` and `function-disallowed-list` cover every
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
const BORDER_WIDTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);
const FONT_WEIGHT_KEYWORDS = new Set(['bold', 'bolder', 'lighter']);
const FONT_SIZE_KEYWORDS = new Set([
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
]);
const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;

/**
 * How each checked property reads its value:
 * - `scalar`: every numeric or identifier token is a picked value (lengths, radii, spacing);
 * - `unitless`: like scalar, for properties whose values are plain numbers (z-index, weight,
 *   line height), so a number inside calc() is a picked value too;
 * - `weight`: numbers and bold/bolder/lighter;
 * - `font`: the `font` shorthand — numbers, size and weight keywords; family names are structure;
 * - `shadow`: lengths are picked values; colors belong to S2; `inset` is structure;
 * - `border`: only the width part (a length or thin/medium/thick) is a picked value;
 * - `motion`: only time values are picked values; property names, easings and names are structure.
 */
const SIDES = '(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?';
const MODES = [
  [/^font-size$/, 'scalar'],
  [/^line-height$/, 'unitless'],
  [/^font-weight$/, 'weight'],
  [/^font$/, 'font'],
  [/^letter-spacing$/, 'scalar'],
  [/^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/, 'scalar'],
  [/^z-index$/, 'unitless'],
  [new RegExp(`^(?:padding|margin)${SIDES}$`), 'scalar'],
  [/^(?:gap|row-gap|column-gap)$/, 'scalar'],
  [new RegExp(`^border${SIDES}-width$`), 'scalar'],
  [new RegExp(`^border${SIDES}$`), 'border'],
  [/^outline-width$/, 'scalar'],
  [/^outline-offset$/, 'scalar'],
  [/^outline$/, 'border'],
  [/^(?:box|text)-shadow$/, 'shadow'],
  [/^(?:transition|animation)(?:-(?:duration|delay))?$/, 'motion'],
];

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

/**
 * Returns the literal tokens in `nodes` that a property in `mode` may not carry.
 * `inMath` is true inside a function such as calc(), where unitless factors are arithmetic —
 * except for `unitless` properties, whose values are those very numbers.
 */
function literalTokens(nodes, mode, inMath) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = unprefixed(node.value);
      if (REFERENCE_FUNCTIONS.has(name)) {
        found.push(...literalTokens(fallbackOf(node), mode, inMath));
      } else if (!OPAQUE_FUNCTIONS.has(name)) {
        found.push(...literalTokens(node.nodes, mode, true));
      }
      continue;
    }
    if (node.type !== 'word') continue;
    const word = node.value;
    const lower = word.toLowerCase();
    if (NEUTRAL_KEYWORDS.has(lower) || word.startsWith('#')) continue;
    const number = valueParser.unit(word);
    if (number) {
      if (Number(number.number) === 0) continue;
      const unit = number.unit.toLowerCase();
      if (mode === 'motion') {
        if (TIME_UNITS.has(unit)) found.push(word);
        continue;
      }
      if (inMath && unit === '' && mode !== 'unitless' && mode !== 'weight') continue;
      found.push(word);
      continue;
    }
    if (inMath) continue; // identifiers inside functions are keywords of the function (round(up, …))
    if (mode === 'border') {
      if (BORDER_WIDTH_KEYWORDS.has(lower)) found.push(word);
    } else if (mode === 'weight') {
      if (FONT_WEIGHT_KEYWORDS.has(lower)) found.push(word);
    } else if (mode === 'font') {
      if (FONT_WEIGHT_KEYWORDS.has(lower) || FONT_SIZE_KEYWORDS.has(lower)) found.push(word);
    } else if (mode === 'scalar' || mode === 'unitless') {
      // Named sizes (small, larger, thin…) pick a value; any other identifier here does too.
      found.push(word);
    }
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
});

/** Lengths, times and named sizes/weights in a custom property value; unitless numbers stay. */
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
    const lower = node.value.toLowerCase();
    const number = valueParser.unit(node.value);
    if (number) {
      if (Number(number.number) !== 0 && number.unit !== '') found.push(node.value);
    } else if (FONT_WEIGHT_KEYWORDS.has(lower) || FONT_SIZE_KEYWORDS.has(lower)) {
      found.push(node.value);
    }
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
});
localLiteral.ruleName = localLiteralName;
localLiteral.messages = localLiteralMessages;

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

export default [strictValue, localLiteral, noCssEscapes];

/**
 * Local Stylelint rules for the web client's UI gate (plan: ~ui-drift-lock §2).
 *
 * - `ui/strict-value` (S1): size, type, shape, depth and timing properties take only `var()`.
 * - `ui/no-local-literal-custom-property` (S4): outside the token stylesheet, a custom property
 *   is never defined as a raw length or time, so a local variable cannot smuggle a literal past S1.
 * - `ui/no-css-escapes` (S7): property names, custom property names and selectors carry no CSS
 *   escapes, so no escaped spelling can hide a property or class from the other rules.
 *
 * Color literals are not checked here: the built-in `color-no-hex`, `color-named` and
 * `function-disallowed-list` rules cover every property (S2, `stylelint.config.mjs`).
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

const MATH_FUNCTIONS = new Set(['calc', 'min', 'max', 'clamp']);
const REFERENCE_FUNCTIONS = new Set(['var', 'env']);
const TIME_UNITS = new Set(['s', 'ms']);
const BORDER_WIDTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);
const FONT_WEIGHT_KEYWORDS = new Set(['bold', 'bolder', 'lighter']);

/**
 * How each checked property reads its value:
 * - `scalar`: every numeric or identifier token is a picked value (lengths, weights, z-index);
 * - `shadow`: lengths are picked values; colors belong to S2; `inset` is structure;
 * - `border`: only the width part (a length or thin/medium/thick) is a picked value;
 * - `motion`: only time values are picked values; property names, easings and names are structure.
 */
const MODES = [
  [/^font-size$/, 'scalar'],
  [/^line-height$/, 'scalar'],
  [/^font-weight$/, 'weight'],
  [/^letter-spacing$/, 'scalar'],
  [/^(?:border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius)$/, 'scalar'],
  [/^z-index$/, 'scalar'],
  [/^(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/, 'scalar'],
  [/^(?:gap|row-gap|column-gap)$/, 'scalar'],
  [/^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-width$/, 'scalar'],
  [/^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/, 'border'],
  [/^box-shadow$/, 'shadow'],
  [/^(?:transition|animation)(?:-(?:duration|delay))?$/, 'motion'],
];

function modeOf(prop) {
  const name = prop.toLowerCase();
  for (const [pattern, mode] of MODES) if (pattern.test(name)) return mode;
  return undefined;
}

function isColorWord(word) {
  return word.startsWith('#');
}

/**
 * Returns the literal tokens in `nodes` that a property in `mode` may not carry.
 * `inMath` is true inside calc()/min()/max()/clamp(), where unitless factors are arithmetic.
 */
function literalTokens(nodes, mode, inMath) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = node.value.toLowerCase();
      if (REFERENCE_FUNCTIONS.has(name)) {
        // var(--x, <fallback>) / env(name, <fallback>): the fallback is a value like any other.
        const comma = node.nodes.findIndex((child) => child.type === 'div' && child.value === ',');
        if (comma !== -1) found.push(...literalTokens(node.nodes.slice(comma + 1), mode, inMath));
      } else if (MATH_FUNCTIONS.has(name) || name === '') {
        found.push(...literalTokens(node.nodes, mode, true));
      }
      // Any other function (colors, easings, gradients, url) is outside S1.
      continue;
    }
    if (node.type !== 'word') continue;
    const word = node.value;
    const lower = word.toLowerCase();
    if (NEUTRAL_KEYWORDS.has(lower) || isColorWord(word)) continue;
    const number = valueParser.unit(word);
    if (number) {
      if (Number(number.number) === 0) continue;
      const unit = number.unit.toLowerCase();
      if (inMath && unit === '') continue;
      if (mode === 'motion' && !TIME_UNITS.has(unit)) continue;
      found.push(word);
      continue;
    }
    if (mode === 'border') {
      if (BORDER_WIDTH_KEYWORDS.has(lower)) found.push(word);
    } else if (mode === 'weight') {
      if (FONT_WEIGHT_KEYWORDS.has(lower)) found.push(word);
    } else if (mode === 'scalar' && !inMath) {
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

/** A custom property value is checked like a length/time value: unitless numbers stay free. */
function customPropertyLiterals(nodes) {
  const found = [];
  for (const node of nodes) {
    if (node.type === 'function') {
      const name = node.value.toLowerCase();
      if (REFERENCE_FUNCTIONS.has(name)) {
        const comma = node.nodes.findIndex((child) => child.type === 'div' && child.value === ',');
        if (comma !== -1) found.push(...customPropertyLiterals(node.nodes.slice(comma + 1)));
      } else if (MATH_FUNCTIONS.has(name) || name === '') {
        found.push(...customPropertyLiterals(node.nodes));
      }
      continue;
    }
    if (node.type !== 'word') continue;
    const number = valueParser.unit(node.value);
    if (number && Number(number.number) !== 0 && number.unit !== '') found.push(node.value);
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

const noCssEscapes = createPlugin(escapesName, (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    if (decl.prop.includes('\\')) {
      report({
        ruleName: escapesName,
        result,
        node: decl,
        message: escapesMessages.rejected('a property name'),
      });
    }
  });
  root.walkRules((rule) => {
    if (rule.selector.includes('\\')) {
      report({
        ruleName: escapesName,
        result,
        node: rule,
        message: escapesMessages.rejected('a selector'),
      });
    }
  });
});
noCssEscapes.ruleName = escapesName;
noCssEscapes.messages = escapesMessages;

export default [strictValue, localLiteral, noCssEscapes];

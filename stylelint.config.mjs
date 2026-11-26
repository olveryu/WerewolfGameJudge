/**
 * Stylelint: the CSS half of the web client's UI gate (rule IDs S1–S7 refer to the UI drift lock
 * plan). Existing violations are recorded in `stylelint-suppressions.json`, and
 * `scripts/ui-baseline-ratchet.mjs` keeps that record exact and shrinking only.
 */
import { ART_LAYER_PATHS, TOKEN_STYLESHEET } from './scripts/ui-lint/registry/artLayer.mjs';
import uiPlugins from './scripts/ui-lint/stylelint-plugin.mjs';

/** S2: every color comes from a `--color-*` / `--report-*` custom property. */
const COLOR_LITERAL_RULES = {
  'color-no-hex': true,
  'color-named': 'never',
  'function-disallowed-list': [
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
  ],
};

/** Rules that police values. The token stylesheet and the art layer are where values live. */
const VALUE_RULES = {
  ...COLOR_LITERAL_RULES,
  'ui/strict-value': true,
  'ui/no-local-literal-custom-property': true,
};

const valueRulesOff = Object.fromEntries(Object.keys(VALUE_RULES).map((rule) => [rule, null]));

export default {
  plugins: uiPlugins,
  rules: {
    ...VALUE_RULES,
    'ui/no-css-escapes': true,
  },
  overrides: [
    {
      files: [TOKEN_STYLESHEET, ...ART_LAYER_PATHS],
      rules: valueRulesOff,
    },
  ],
};

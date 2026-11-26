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
  // CSS function names are case-insensitive (`RGB()` renders), so the list is one /i pattern.
  'function-disallowed-list': ['/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i'],
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
  // A disable comment would switch the gate off for a line or a file and hide the debt from the
  // ratchet, so disable comments have no effect: debt is recorded in the baseline or fixed.
  ignoreDisables: true,
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

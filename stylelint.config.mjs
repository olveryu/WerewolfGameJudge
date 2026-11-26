/**
 * Stylelint: the CSS half of the web client's UI gate (rule IDs S1–S7 refer to the UI drift lock
 * plan). This is the only Stylelint configuration: `scripts/ui-lint/styleGate.mjs` passes it
 * explicitly and rejects any other config, ignore or suppressions file. Existing violations are
 * recorded in `ui-style-baseline.json`, which `scripts/ui-baseline-ratchet.mjs` keeps exact and
 * shrinking only. Run it through `pnpm run lint:css`, not the bare `stylelint` CLI.
 */
import { ART_LAYER_STYLESHEETS, TOKEN_STYLESHEET } from './scripts/ui-lint/registry/artLayer.mjs';
import uiPlugins from './scripts/ui-lint/stylelint-plugin.mjs';

/** S2: every color comes from a `--color-*` / `--report-*` custom property. */
const COLOR_LITERAL_RULES = {
  'color-no-hex': true,
  'color-named': 'never',
  // CSS function names are case-insensitive (`RGB()` renders), so the list is one /i pattern.
  'function-disallowed-list': ['/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i'],
  'ui/no-system-color': true,
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
      files: [TOKEN_STYLESHEET, ...ART_LAYER_STYLESHEETS],
      rules: valueRulesOff,
    },
  ],
};

/**
 * The UI gate's Stylelint configuration (UI drift lock plan v3, §3), generated from
 * `registry.mjs`. `gate.mjs` passes it to `stylelint.lint()` as an object, so no stylesheet
 * directory can bring its own configuration, and inline `stylelint-disable` comments are ignored.
 */
import { ART_SHEETS, AT_RULES, TOKEN_SHEET } from './registry.mjs';
import plugins from './stylelint-plugin.mjs';

const exempt = (file, rules) => ({
  files: [file],
  rules: { 'ui/value-allowlist': null, ...rules },
});

export default {
  plugins,
  ignoreDisables: true,
  rules: {
    'ui/value-allowlist': true,
    'at-rule-allowed-list': [...AT_RULES],
  },
  overrides: [
    exempt(TOKEN_SHEET.file, {
      'ui/sheet-scope': { kind: 'tokens', selectors: [...TOKEN_SHEET.selectors] },
    }),
    ...Object.entries(ART_SHEETS).map(([file, prefix]) =>
      exempt(file, { 'ui/sheet-scope': { kind: 'art', prefix } }),
    ),
  ],
};

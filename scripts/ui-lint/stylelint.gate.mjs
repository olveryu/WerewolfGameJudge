/**
 * The UI gate's Stylelint configuration (UI drift lock plan v3, §3), generated from
 * `registry.mjs`. `gate.mjs` passes it to `stylelint.lint()` as an object, so no stylesheet
 * directory can bring its own configuration, and inline `stylelint-disable` comments are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';

import { ART_SHEETS, AT_RULES, RUNTIME_TOKEN_FAMILIES, TOKEN_SHEET } from './registry.mjs';
import plugins from './stylelint-plugin.mjs';

const tokens = new Set();
postcss
  .parse(fs.readFileSync(path.resolve(import.meta.dirname, '../..', TOKEN_SHEET.file), 'utf8'))
  .walkDecls((decl) => {
    if (decl.prop.startsWith('--')) tokens.add(decl.prop);
  });

const exempt = (file, rules) => ({
  files: [file],
  rules: { 'ui/value-allowlist': null, ...rules },
});

export default {
  plugins,
  ignoreDisables: true,
  rules: {
    'ui/value-allowlist': { tokens: [...tokens].sort(), families: [...RUNTIME_TOKEN_FAMILIES] },
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

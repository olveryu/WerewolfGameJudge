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

const tokenOptions = { tokens: [...tokens].sort(), families: [...RUNTIME_TOKEN_FAMILIES] };

export default {
  plugins,
  ignoreDisables: true,
  rules: {
    'ui/value-allowlist': tokenOptions,
    'at-rule-allowed-list': [...AT_RULES],
  },
  overrides: [
    {
      files: [TOKEN_SHEET.file],
      rules: {
        'ui/value-allowlist': null,
        'ui/sheet-scope': { kind: 'tokens', selectors: [...TOKEN_SHEET.selectors] },
      },
    },
    // An art sheet's selectors carry its prefix (D7); its values take the allow list like any
    // sheet's (user's whitelist rule, 2026-11-26 14:43).
    ...Object.entries(ART_SHEETS).map(([file, prefix]) => ({
      files: [file],
      rules: { 'ui/sheet-scope': { kind: 'art', prefix } },
    })),
  ],
};

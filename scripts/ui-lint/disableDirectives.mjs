/**
 * Inline comments may not switch off or reconfigure the UI gate's ESLint rules (P1 QA1 F10,
 * QA2 G4).
 *
 * ESLint honours `eslint-disable*` and `/* eslint rule: … *\/` comments for every rule and cannot
 * be told to ignore them for a few rules only, so this check runs beside ESLint, in the ratchet.
 * It does not parse comments itself: ESLint's own `SourceCode` finds the directive comments and
 * ESLint's own `ConfigCommentParser` reads their rule lists, exactly as the linter does — multi-line
 * comments, quoted rule names and every other spelling ESLint accepts are read the same way here.
 *
 * Rejected: a disable directive that names a gate rule or names no rule (which disables every
 * rule), and a configuration comment that names a gate rule at all (it could turn it off or change
 * its options).
 */
import { createRequire } from 'node:module';

import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

// The comment parser ESLint itself uses, resolved from ESLint's own dependencies.
const eslintRequire = createRequire(createRequire(import.meta.url).resolve('eslint'));
const { ConfigCommentParser } = eslintRequire('@eslint/plugin-kit');
const commentParser = new ConfigCommentParser();

/** ESLint rules an inline comment may not name. `ui/` covers every local UI gate rule. */
export const GATE_RULE_PREFIXES = ['ui/'];
export const GATE_RULES = new Set([
  'no-eval',
  'no-new-func',
  '@typescript-eslint/no-implied-eval',
  'react/no-danger',
]);

export function isGateRule(rule) {
  return GATE_RULES.has(rule) || GATE_RULE_PREFIXES.some((prefix) => rule.startsWith(prefix));
}

/** Collects the directive comments of one file through ESLint's SourceCode. */
function collector(found, ran) {
  return {
    create(context) {
      return {
        Program() {
          ran.done = true;
          const { sourceCode } = context;
          for (const { type, value, node } of sourceCode.getDisableDirectives().directives) {
            if (type === 'enable') continue;
            const rules = Object.keys(commentParser.parseListConfig(value));
            if (rules.length === 0 || rules.some(isGateRule)) {
              found.push({ line: node.loc.start.line, text: sourceCode.getText(node) });
            }
          }
          const { configs } = sourceCode.applyInlineConfig();
          for (const { config, loc } of configs) {
            if (Object.keys(config.rules ?? {}).some(isGateRule)) {
              const comment = sourceCode
                .getInlineConfigNodes()
                .find((candidate) => candidate.loc.start.line === loc.start.line);
              found.push({
                line: loc.start.line,
                text: comment ? sourceCode.getText(comment) : '/* eslint … */',
              });
            }
          }
        },
      };
    },
  };
}

/**
 * `{ line, text }` for each comment in `source` that disables a gate rule or every rule, or
 * configures a gate rule. `filename` picks the parser options (JSX for .tsx/.jsx).
 */
export function gateDisableDirectives(source, filename = 'file.tsx') {
  const found = [];
  const ran = { done: false };
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(
    source,
    [
      {
        files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: /\.[jt]sx$/.test(filename) } },
        },
        // Inline config must not switch the collector itself off.
        linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
        plugins: { scan: { rules: { collect: collector(found, ran) } } },
        rules: { 'scan/collect': 'error' },
      },
    ],
    filename,
  );
  const fatal = messages.find((message) => message.fatal);
  if (fatal) throw new Error(`${filename}:${fatal.line}: ${fatal.message}`);
  // Fail closed: a file the scan did not read is not a file without directives.
  if (!ran.done) throw new Error(`${filename}: the directive scan did not run`);
  return found.sort((a, b) => a.line - b.line);
}

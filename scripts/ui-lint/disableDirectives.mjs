/**
 * Inline disable comments may not switch off the UI gate's ESLint rules (P1 QA1 F10).
 *
 * ESLint honours `eslint-disable*` comments for every rule and cannot be told to ignore them for a
 * few rules only, so this check runs beside ESLint, in the ratchet: a directive that names a gate
 * rule, or names no rule at all (which disables every rule), is rejected. Directives the scanner
 * cannot read completely — a rule list continued on the next line — count as naming no rule, so
 * the check fails closed. Stylelint needs no such scan: its config sets `ignoreDisables`.
 */

/** ESLint rules a disable comment may not name. `ui/` covers every local UI gate rule. */
export const GATE_RULE_PREFIXES = ['ui/'];
export const GATE_RULES = new Set(['no-eval', 'no-new-func', '@typescript-eslint/no-implied-eval']);

const DIRECTIVE =
  /(?:\/\/|\/\*)\s*(eslint-disable(?:-next-line|-line)?|eslint)(?=[\s*]|$)([^\n]*?)(?:\*\/|$)/gm;

function isGateRule(rule) {
  return GATE_RULES.has(rule) || GATE_RULE_PREFIXES.some((prefix) => rule.startsWith(prefix));
}

/** Rule names in a directive body (`a, b -- reason`, or `a: off, b: 0` for config comments). */
function directiveRules(kind, body) {
  const list = body.split(/\s--\s|\s--$/)[0];
  const names = list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (kind === 'eslint' ? part.split(':')[0].trim() : part.split(/\s/)[0]));
  return names;
}

/** `{ line, text }` for each directive in `source` that disables a gate rule or every rule. */
export function gateDisableDirectives(source) {
  const found = [];
  for (const match of source.matchAll(DIRECTIVE)) {
    const [text, kind, body] = match;
    const rules = directiveRules(kind, body);
    const offending =
      kind === 'eslint' ? rules.some(isGateRule) : rules.length === 0 || rules.some(isGateRule);
    if (offending) {
      const line = source.slice(0, match.index).split('\n').length;
      found.push({ line, text: text.trim() });
    }
  }
  return found;
}

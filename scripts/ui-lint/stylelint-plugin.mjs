/**
 * Local Stylelint rules of the UI gate (UI drift lock plan v3, §2). Both are allow lists over
 * `registry.mjs`:
 *
 * - `ui/value-allowlist` (S1, S2, S4, S7): every property is registered and its value passes the
 *   shared checker (`values.mjs`, which ESLint runs on inline styles too). A custom property
 *   defined outside the token sheet only aliases tokens and never redefines a tokens.css name.
 *   Each problem is reported at the offending word, so the baseline fingerprint is its line.
 * - `ui/sheet-scope` (S10): the token sheet holds only custom property definitions under its
 *   registered selectors; in an art sheet every class carries the sheet's prefix and every
 *   selector's subject (its last compound) carries one, so the sheet styles only art elements.
 */
import stylelint from 'stylelint';
import selectorParser from 'postcss-selector-parser';

import { FORCED_COLORS_MEDIA } from './registry.mjs';
import { domainOf, valueMessages, valueProblems } from './values.mjs';

const {
  createPlugin,
  utils: { report, ruleMessages },
} = stylelint;

const VALUE = 'ui/value-allowlist';
const messages = ruleMessages(VALUE, valueMessages);

function inForcedColors(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media') {
      if (parent.params.replace(/\s+/g, '').toLowerCase() === FORCED_COLORS_MEDIA) return true;
    }
  }
  return false;
}

/**
 * Options: `{ tokens, families }`, the custom properties tokens.css defines and the prefixes of
 * the token families published at runtime.
 */
const valueAllowlist = createPlugin(VALUE, (options) => (root, result) => {
  if (!options) return;
  const tokens = new Set(options.tokens ?? []);
  const families = options.families ?? [];
  root.walkDecls((decl) => {
    const raw = decl.prop;
    const domain = domainOf(raw);
    if (domain === undefined) {
      report({ result, ruleName: VALUE, node: decl, message: messages.property(raw), word: raw });
      return;
    }
    if (tokens.has(raw) || families.some((family) => raw.startsWith(family))) {
      report({ result, ruleName: VALUE, node: decl, message: messages.token(raw), word: raw });
    }
    const valueStart = decl.toString().indexOf(decl.value, decl.prop.length);
    const prop = domain === 'custom' ? 'custom property' : raw.toLowerCase();
    for (const problem of valueProblems(decl.value, prop, domain, {
      forced: inForcedColors(decl),
    })) {
      report({
        result,
        ruleName: VALUE,
        node: decl,
        message: problem.message,
        index: valueStart + problem.index,
        endIndex: valueStart + problem.endIndex,
      });
    }
  });
});

const SCOPE = 'ui/sheet-scope';
const scopeMessages = ruleMessages(SCOPE, {
  tokenDecl: (prop) =>
    `The token sheet holds only custom property definitions; \`${prop}\` is not one (UI gate S10).`,
  tokenSelector: (selector) =>
    `\`${selector}\` is not a registered token-sheet selector (UI gate S10).`,
  escaped: 'Selectors in the token and art sheets are not escaped (UI gate S10).',
  artClass: (name, prefix) =>
    `\`.${name}\` is not an art class of this sheet (prefix \`${prefix}\`; UI gate S10).`,
  artSubject: (selector, prefix) =>
    `The subject of \`${selector}\` is not a \`${prefix}\` element: its last compound needs a \`${prefix}\` class (UI gate S10).`,
  unparsable: (selector) => `\`${selector}\` does not parse as a selector (UI gate S10).`,
  artAttribute: 'Art sheets select by class, not by `class`/`id` attributes (UI gate S10).',
});

function inKeyframes(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

const sheetScope = createPlugin(SCOPE, (options) => (root, result) => {
  if (!options) return;
  const flag = (node, message) => report({ result, ruleName: SCOPE, node, message });
  if (options.kind === 'tokens') {
    root.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) flag(decl, scopeMessages.tokenDecl(decl.prop));
    });
    root.walkRules((rule) => {
      if (rule.selector.includes('\\')) return flag(rule, scopeMessages.escaped);
      for (const part of rule.selectors) {
        if (!options.selectors.includes(part.trim())) flag(rule, scopeMessages.tokenSelector(part));
      }
    });
    return;
  }
  const { prefix } = options;
  const own = (name) =>
    name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}__`);
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    if (rule.selector.includes('\\')) return flag(rule, scopeMessages.escaped);
    let selectors;
    try {
      selectors = selectorParser().astSync(rule.selector);
    } catch {
      return flag(rule, scopeMessages.unparsable(rule.selector));
    }
    selectors.each((selector) => {
      const text = selector.toString().trim();
      // The subject is the compound after the last top-level combinator; it must itself carry a
      // class of this sheet (not one inside `:not()`, `:has()`, `:is()`), so a rule here styles
      // only art elements whatever its context says.
      const nodes = selector.nodes;
      let start = 0;
      nodes.forEach((node, index) => {
        if (node.type === 'combinator') start = index + 1;
      });
      const subject = nodes.slice(start);
      if (!subject.some((node) => node.type === 'class' && own(node.value)))
        flag(rule, scopeMessages.artSubject(text, prefix));
      selector.walkClasses((node) => {
        if (!own(node.value)) flag(rule, scopeMessages.artClass(node.value, prefix));
      });
      selector.walkAttributes((node) => {
        if (/^(?:class|id)$/i.test(node.attribute)) flag(rule, scopeMessages.artAttribute);
      });
    });
  });
});

export default [valueAllowlist, sheetScope];

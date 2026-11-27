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
import valueParser from 'postcss-value-parser';

import {
  BREAKPOINTS,
  CONDITION_FEATURES,
  CONDITION_WORDS,
  FORCED_COLORS_MEDIA,
} from './registry.mjs';
import { domainOf, valueMessages, valueProblems } from './values.mjs';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

const isString = (value) => typeof value === 'string';
const isKind = (value) => value === 'tokens' || value === 'art';

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
 * Problems of an at-rule's condition, as `{ index, endIndex, message }` offsets into its params
 * (P1 QA12 nit 8). `@media`/`@container`: every feature is registered, every length a registered
 * breakpoint (a container's leading name is free). `@supports`: each `(property: value)` test
 * takes the declaration check; `selector()` tests a selector and holds no value.
 */
function conditionProblems(rule) {
  const name = rule.name.toLowerCase();
  const problems = [];
  const flag = (node, message) =>
    problems.push({ index: node.sourceIndex, endIndex: node.sourceEndIndex, message });
  const nodes = valueParser(rule.params).nodes;
  if (name === 'supports') {
    const test = (group) => {
      for (const node of group) {
        if (node.type === 'word' && !CONDITION_WORDS.has(node.value.toLowerCase()))
          flag(node, valueMessages.feature(node.value, name));
        if (node.type !== 'function') continue;
        if (node.value.toLowerCase() === 'selector') continue;
        if (node.value !== '') {
          flag(node, valueMessages.func(node.value));
          continue;
        }
        const colon = node.nodes.findIndex((child) => child.type === 'div' && child.value === ':');
        if (colon === -1) {
          test(node.nodes);
          continue;
        }
        const prop = valueParser.stringify(node.nodes.slice(0, colon)).trim();
        const value = valueParser.stringify(node.nodes.slice(colon + 1)).trim();
        const domain = domainOf(prop);
        if (domain === undefined) {
          flag(node, valueMessages.property(prop));
          continue;
        }
        const start = node.nodes[colon + 1]?.sourceIndex ?? node.sourceIndex;
        const offset = start + valueParser.stringify(node.nodes.slice(colon + 1)).search(/\S/);
        for (const problem of valueProblems(value, prop.toLowerCase(), domain))
          problems.push({
            index: offset + problem.index,
            endIndex: offset + problem.endIndex,
            message: problem.message,
          });
      }
    };
    test(nodes);
    return problems;
  }
  // A word is a feature, a joining word, a range operator or a length; inside
  // `(feature: value)` the value is a keyword of its feature (`hover`, `reduce`) or a length.
  const word = (node, featureValue) => {
    const text = node.value.toLowerCase();
    const number = valueParser.unit(text);
    if (number) {
      if (Number(number.number) !== 0 && number.unit !== '' && !BREAKPOINTS.has(text))
        flag(node, valueMessages.breakpoint(node.value, name));
      return;
    }
    if (featureValue || /^[<>=]+$/.test(text) || CONDITION_WORDS.has(text)) return;
    if (!CONDITION_FEATURES.has(text)) flag(node, valueMessages.feature(node.value, name));
  };
  const condition = (group) => {
    const colon = group.findIndex((child) => child.type === 'div' && child.value === ':');
    group.forEach((node, index) => {
      if (node.type === 'function') {
        if (node.value !== '') flag(node, valueMessages.func(node.value));
        else condition(node.nodes);
      } else if (node.type === 'word') word(node, colon !== -1 && index > colon);
    });
  };
  const leading = name === 'container' && nodes[0]?.type === 'word' ? 1 : 0;
  condition(nodes.slice(leading));
  return problems;
}

/**
 * Options: `{ tokens, families }`, the custom properties tokens.css defines and the prefixes of
 * the token families published at runtime. Every sheet the rule runs on takes the whole allow
 * list, art sheets included: no sheet's values go unchecked (D7, user's whitelist rule 14:43).
 */
const valueAllowlist = createPlugin(VALUE, (options) => (root, result) => {
  // A rule enabled without its lists would allow nothing it should know about: the options are
  // required, and an invalid one is an invalid-option warning the gate fails on.
  const valid = validateOptions(result, VALUE, {
    actual: options,
    possible: { tokens: [isString], families: [isString] },
  });
  if (!valid || !Array.isArray(options.tokens) || !Array.isArray(options.families))
    throw new Error(`${VALUE} needs { tokens: string[], families: string[] } options.`);
  const tokens = new Set(options.tokens);
  const { families } = options;
  const keyframes = new Set();
  root.walkAtRules(/keyframes$/i, (rule) => keyframes.add(rule.params.trim()));
  root.walkAtRules(/^(?:media|container|supports)$/i, (rule) => {
    const start = `@${rule.name}${rule.raws.afterName ?? ''}`.length;
    for (const problem of conditionProblems(rule))
      report({
        result,
        ruleName: VALUE,
        node: rule,
        message: problem.message,
        index: start + problem.index,
        endIndex: start + problem.endIndex,
      });
  });
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
    const prop = domain === 'custom' ? 'custom property' : raw.toLowerCase();
    // PostCSS strips comments from `decl.value` and keeps the source text in `raws.value.raw`:
    // problem offsets in the stripped value do not map onto the source then, so such a
    // declaration is reported as a whole (its whole span is the fingerprint, P1 QA10).
    const exact = decl.raws.value === undefined;
    const valueStart = exact ? decl.toString().indexOf(decl.value, decl.prop.length) : 0;
    for (const problem of valueProblems(decl.value, prop, domain, {
      forced: inForcedColors(decl),
      keyframes,
    })) {
      report({
        result,
        ruleName: VALUE,
        node: decl,
        message: problem.message,
        ...(exact
          ? { index: valueStart + problem.index, endIndex: valueStart + problem.endIndex }
          : {}),
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
  artKeyframes: (name, prefix) =>
    `Keyframes \`${name}\` of an art sheet carry its prefix \`${prefix}\` (UI gate S10).`,
});

function inKeyframes(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

const sheetScope = createPlugin(SCOPE, (options) => (root, result) => {
  const valid = validateOptions(result, SCOPE, {
    actual: options,
    possible: { kind: [isKind], selectors: [isString], prefix: [isString] },
  });
  const complete =
    options?.kind === 'tokens' ? Array.isArray(options.selectors) : isString(options?.prefix);
  if (!valid || !complete)
    throw new Error(`${SCOPE} needs { kind: 'tokens', selectors } or { kind: 'art', prefix }.`);
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
  root.walkAtRules(/keyframes$/i, (rule) => {
    if (!own(rule.params.trim()))
      flag(rule, scopeMessages.artKeyframes(rule.params.trim(), prefix));
  });
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    if (rule.selector.includes('\\')) return flag(rule, scopeMessages.escaped);
    const nested = rule.parent?.type === 'rule';
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
      // `&` in a nested rule's subject is the parent's subject, which is checked on its own.
      const art = (node) =>
        (node.type === 'class' && own(node.value)) || (nested && node.type === 'nesting');
      if (!subject.some(art)) flag(rule, scopeMessages.artSubject(text, prefix));
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

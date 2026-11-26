/**
 * Local Stylelint rules of the UI gate (UI drift lock plan v3, §2). Both are allow lists over
 * `registry.mjs`:
 *
 * - `ui/value-allowlist` (S1, S2, S4, S7): every property is registered (by its lower-case name
 *   without a vendor prefix; an escaped name is never registered). A property in a token domain
 *   takes only that domain's atoms: `var()` (fallback read in the same domain), a global keyword,
 *   zero, a domain keyword, or `calc`/`min`/`max`/`clamp` over atoms where the only number is the
 *   sign flip `-1`. Every function anywhere is a registered function. System colors are atoms only
 *   inside exactly `@media (forced-colors: active)`. A custom property definition is the `custom`
 *   domain. Each problem is reported at the offending word, so the baseline fingerprint is the
 *   line holding it.
 * - `ui/sheet-scope` (S10): the token sheet holds only custom property definitions under its
 *   registered selectors; an art sheet's selectors use only classes with the sheet's prefix.
 */
import stylelint from 'stylelint';
import valueParser from 'postcss-value-parser';

import {
  DOMAIN_COMMON,
  DOMAINS,
  FORCED_COLORS_MEDIA,
  FUNCTIONS,
  PROPERTIES,
  SYSTEM_COLORS,
} from './registry.mjs';

const {
  createPlugin,
  utils: { report, ruleMessages },
} = stylelint;

const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;
const MATH = new Set(['calc', 'min', 'max', 'clamp']);
const OPERATORS = new Set(['+', '-', '*', '/']);
const IDENT = /^-?[a-z_][\w-]*$/i;
/** Color atoms besides `var()`: every domain that holds a color accepts them. */
const COLOR_KEYWORDS = new Set(['transparent', 'currentcolor']);

const VALUE = 'ui/value-allowlist';
const valueMessages = ruleMessages(VALUE, {
  property: (prop) => `\`${prop}\` is not a registered property (UI gate S1).`,
  func: (name) => `\`${name}()\` is not a registered CSS function (UI gate S2).`,
  atom: (word, prop, domain) =>
    `\`${word}\` is not allowed in \`${prop}\`: the ${domain} domain takes var(--token) and registered keywords (UI gate S1).`,
});

function inForcedColors(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media') {
      if (parent.params.replace(/\s+/g, '').toLowerCase() === FORCED_COLORS_MEDIA) return true;
    }
  }
  return false;
}

function isZero(word) {
  const number = valueParser.unit(word);
  return Boolean(number) && Number(number.number) === 0;
}

/** The top-level comma-separated arguments of a function node. */
function argumentsOf(node) {
  const groups = [[]];
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') groups.push([]);
    else groups.at(-1).push(child);
  }
  return groups;
}

function checkValue(decl, prop, domainName, result) {
  const forced = inForcedColors(decl);
  const valueStart = decl.toString().indexOf(decl.value, decl.prop.length);
  const problem = (node, message) =>
    report({
      result,
      ruleName: VALUE,
      node: decl,
      message,
      index: valueStart + node.sourceIndex,
      endIndex: valueStart + node.sourceEndIndex,
    });

  /** Is one word an atom of `domain`? */
  const atom = (node, domain, name, inMath) => {
    const text = node.value;
    const lower = text.toLowerCase();
    if (isZero(text)) return true;
    if (inMath && (OPERATORS.has(text) || text === '-1')) return true;
    if (DOMAIN_COMMON.keywords.includes(lower) || domain.keywords?.includes(lower)) return true;
    if (domain.colors && COLOR_KEYWORDS.has(lower)) return true;
    if (forced && domain.colors && SYSTEM_COLORS.has(lower)) return true;
    const number = valueParser.unit(text);
    if (number) {
      if (number.unit === '')
        return Boolean(domain.unitless) && (!inMath || Boolean(domain.mathNumbers));
      return !inMath && Boolean(domain.units?.includes(number.unit.toLowerCase()));
    }
    return Boolean(domain.idents) && !text.startsWith('#') && IDENT.test(text);
  };

  /** Every function in `nodes` (at any depth) is registered; nothing else is checked. */
  const registeredOnly = (nodes) => {
    for (const node of nodes) {
      if (node.type !== 'function') continue;
      if (node.value !== '' && !FUNCTIONS.has(node.value))
        problem(node, valueMessages.func(node.value));
      else registeredOnly(node.nodes);
    }
  };

  /** clip-path: shapes are free, except the corner radius after `round` (radius domain). */
  const shape = (nodes) => {
    let afterRound = false;
    for (const node of nodes) {
      if (afterRound && node.type !== 'space') {
        walk([node], DOMAINS.radius, 'radius');
      } else if (node.type === 'word' && node.value.toLowerCase() === 'round') {
        afterRound = true;
      } else if (node.type === 'function') {
        if (node.value !== '' && !FUNCTIONS.has(node.value))
          problem(node, valueMessages.func(node.value));
        else shape(node.nodes);
      }
    }
  };

  /** Walk value nodes in a token domain: every word is an atom of it. */
  const walk = (nodes, domain, name, inMath = false) => {
    for (const node of nodes) {
      if (node.type === 'space' || node.type === 'comment' || node.type === 'div') continue;
      if (node.type === 'string') {
        problem(node, valueMessages.atom(`"${node.value}"`, prop, name));
        continue;
      }
      if (node.type === 'word') {
        if (!atom(node, domain, name, inMath))
          problem(node, valueMessages.atom(node.value, prop, name));
        continue;
      }
      const lower = node.value.toLowerCase();
      if (lower === '') {
        walk(node.nodes, domain, name, inMath);
        continue;
      }
      if (!FUNCTIONS.has(node.value)) {
        problem(node, valueMessages.func(node.value));
        continue;
      }
      if (!DOMAIN_COMMON.functions.includes(lower) && !domain.functions?.includes(lower)) {
        problem(node, valueMessages.atom(`${node.value}()`, prop, name));
        continue;
      }
      if (lower === 'var') {
        const [reference, ...fallback] = argumentsOf(node);
        const first = reference.find((child) => child.type !== 'space');
        if (first?.type !== 'word' || !first.value.startsWith('--')) {
          problem(node, valueMessages.atom('var()', prop, name));
        }
        walk(fallback.flat(), domain, name, inMath);
        continue;
      }
      if (lower === 'env') continue;
      // Math reads its operands as atoms; a domain function (gradient, filter, easing) its arguments.
      walk(node.nodes, domain, name, inMath || MATH.has(lower));
    }
  };

  const nodes = valueParser(decl.value).nodes;
  if (domainName === 'free') registeredOnly(nodes);
  else if (DOMAINS[domainName].shape) shape(nodes);
  else walk(nodes, DOMAINS[domainName], domainName);
}

const valueAllowlist = createPlugin(VALUE, (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    const raw = decl.prop;
    const custom = raw.startsWith('--');
    let domain;
    if (!raw.includes('\\'))
      domain = custom ? 'custom' : PROPERTIES.get(raw.toLowerCase().replace(VENDOR_PREFIX, ''));
    if (domain === undefined) {
      report({
        result,
        ruleName: VALUE,
        node: decl,
        message: valueMessages.property(raw),
        word: raw,
      });
      return;
    }
    checkValue(decl, custom ? 'custom property' : raw.toLowerCase(), domain, result);
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
  artBare: (selector, prefix) => `\`${selector}\` selects no \`${prefix}\` class (UI gate S10).`,
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
    if (/\[\s*(?:class|id)\b/i.test(rule.selector)) flag(rule, scopeMessages.artAttribute);
    for (const part of rule.selectors) {
      const classes = [...part.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
      if (classes.length === 0) flag(rule, scopeMessages.artBare(part.trim(), prefix));
      for (const name of classes) if (!own(name)) flag(rule, scopeMessages.artClass(name, prefix));
    }
  });
});

export default [valueAllowlist, sheetScope];

/**
 * The one value checker of the UI gate (UI drift lock plan v3, §2 S1, S2, S4, E4): Stylelint
 * runs it on stylesheet declarations, ESLint on inline style values and SVG presentation
 * attributes, both against the same `registry.mjs` tables.
 */
import valueParser from 'postcss-value-parser';

import {
  ANIMATION_KEYWORDS,
  ANIMATION_NAMES,
  COLOR_KEYWORDS,
  DOMAIN_COMMON,
  DOMAINS,
  FUNCTIONS,
  MATH,
  OPERATORS,
  PROPERTIES,
  REFERENCES,
  SYSTEM_COLORS,
} from './registry.mjs';

const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;
const IDENT = /^-?[a-z_][\w-]*$/i;

/**
 * Where a reported value is written, appended to its message as `Written at file:line[, …].`
 * (`withOrigins`) and read back by the gate (`originsOf`) to put those source lines in the
 * fingerprint. One format, defined here only.
 */
const ORIGINS = / Written at ([^ ,]+:\d+(?:-\d+)?(?:, [^ ,]+:\d+(?:-\d+)?)*)\.$/;
export function withOrigins(message, origins) {
  const unique = [...new Set(origins)];
  return unique.length === 0 ? message : `${message} Written at ${unique.join(', ')}.`;
}
export function originsOf(message) {
  const match = ORIGINS.exec(message);
  return match === null
    ? []
    : match[1].split(', ').map((origin) => {
        // `file:line` or `file:line-endLine` (a value written over several lines).
        const at = origin.lastIndexOf(':');
        const [line, endLine = line] = origin
          .slice(at + 1)
          .split('-')
          .map(Number);
        return { file: origin.slice(0, at), line, endLine };
      });
}

export const valueMessages = {
  measure: (word, prop) =>
    `\`${word}\` is not allowed in \`${prop}\`: it takes keywords and counts only (UI gate S1).`,
  property: (prop) => `\`${prop}\` is not a registered property (UI gate S1).`,
  func: (name) => `\`${name}()\` is not a registered CSS function (UI gate S2).`,
  atom: (word, prop, domain) =>
    `\`${word}\` is not allowed in \`${prop}\`: the ${domain} domain takes var(--token) and registered keywords (UI gate S1).`,
  token: (prop) =>
    `\`${prop}\` is a design token; only tokens.css or colors.ts defines it (UI gate S4).`,
  feature: (word, rule) =>
    `\`${word}\` is not a registered \`@${rule}\` feature or word (UI gate S1).`,
  breakpoint: (word, rule) =>
    `\`${word}\` in an \`@${rule}\` condition is not a registered breakpoint (UI gate S1).`,
  runtime: (prop, kind) =>
    `This \`${prop}\` value is a runtime ${kind}: the gate cannot show it is a token, so pass it through a custom property (\`--x\`, read by a stylesheet's \`var()\`) or write a token (UI gate E4, D15).`,
  keyframes: (name) =>
    `\`${name}\` is not a keyframes rule of this stylesheet; an animation runs only keyframes its own sheet defines (UI gate S1).`,
};

/**
 * The domain of a property name, or undefined when it is not registered: a custom property is
 * the `custom` domain; others by lower-case name without a vendor prefix (never escaped).
 */
export function domainOf(prop) {
  if (prop.includes('\\')) return undefined;
  if (prop.startsWith('--')) return 'custom';
  return PROPERTIES.get(prop.toLowerCase().replace(VENDOR_PREFIX, ''));
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

function isZero(word) {
  const number = valueParser.unit(word);
  return Boolean(number) && Number(number.number) === 0;
}

/**
 * Problems of `value` in property `prop` (domain `domainName`): `[{ index, endIndex, message }]`
 * with offsets into `value`. `forced` is true inside `@media (forced-colors: active)`;
 * `keyframes` holds the keyframes names the same stylesheet defines (none for inline styles).
 */
export function valueProblems(
  value,
  prop,
  domainName,
  { forced = false, keyframes = new Set() } = {},
) {
  const problems = [];
  const animation = ANIMATION_NAMES.has(prop.replace(VENDOR_PREFIX, ''));
  const problem = (node, message) =>
    problems.push({ index: node.sourceIndex, endIndex: node.sourceEndIndex, message });

  const atom = (node, domain, inMath) => {
    const text = node.value;
    const lower = text.toLowerCase();
    if (isZero(text)) return true;
    if (inMath && (OPERATORS.has(text) || text === '-1')) return true;
    if (DOMAIN_COMMON.keywords.includes(lower) || domain.keywords?.includes(lower)) return true;
    if (domain.literals?.includes(text)) return true;
    if (domain.colors && COLOR_KEYWORDS.has(lower)) return true;
    if (forced && domain.colors && SYSTEM_COLORS.has(lower)) return true;
    const number = valueParser.unit(text);
    if (number) {
      if (number.unit === '') return Boolean(domain.unitless) && !inMath;
      return Boolean(domain.units?.includes(number.unit.toLowerCase()));
    }
    if (!domain.idents || text.startsWith('#') || !IDENT.test(text)) return false;
    if (animation && !ANIMATION_KEYWORDS.has(lower) && !keyframes.has(text)) {
      problem(node, valueMessages.keyframes(text));
    }
    return true;
  };

  /** Every function in `nodes` (at any depth) is registered; nothing else is checked. */
  /** The free domain: keywords and counts (`grid-row: 1 / -1`), never a length or ratio. */
  const registeredOnly = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'word') {
        const number = valueParser.unit(node.value);
        if (number !== false && number.unit !== '')
          problem(node, valueMessages.measure(node.value, prop));
      }
      if (node.type !== 'function') continue;
      if (node.value !== '' && !FUNCTIONS.has(node.value))
        problem(node, valueMessages.func(node.value));
      else if (!REFERENCES.has(node.value)) registeredOnly(node.nodes);
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
        else if (!REFERENCES.has(node.value)) shape(node.nodes);
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
      if (node.type === 'word' || node.type === 'unicode-range') {
        if (!atom(node, domain, inMath)) problem(node, valueMessages.atom(node.value, prop, name));
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
      if (
        !DOMAIN_COMMON.functions.includes(lower) &&
        !domain.functions?.some((allowed) => allowed.toLowerCase() === lower)
      ) {
        problem(node, valueMessages.atom(`${node.value}()`, prop, name));
        continue;
      }
      if (lower === 'var' || lower === 'env') {
        // The first argument names a variable; the fallback is a value of this domain.
        const [reference, ...fallback] = argumentsOf(node);
        const first = reference.find((child) => child.type !== 'space');
        if (first?.type !== 'word' || first.value.startsWith('--') !== (lower === 'var')) {
          problem(node, valueMessages.atom(`${lower}()`, prop, name));
        }
        walk(fallback.flat(), domain, name, inMath);
        continue;
      }
      if (lower === 'url') continue;
      // Math reads its operands as atoms; a domain function (gradient, filter, easing) its arguments.
      walk(node.nodes, domain, name, inMath || MATH.has(lower));
    }
  };

  const nodes = valueParser(value).nodes;
  if (domainName === 'free') registeredOnly(nodes);
  else if (DOMAINS[domainName].shape) shape(nodes);
  else walk(nodes, DOMAINS[domainName], domainName);
  return problems;
}

/**
 * Whether a runtime value (`{ runtime, text }`, the reading of an expression the gate cannot read
 * as a literal) fits `prop` whatever it holds (plan v3.9 D15 ②). Only two kinds do: any value of
 * a custom property, the one channel by which a computed value reaches CSS (the stylesheet that
 * reads it through `var()` is checked as any other), and a number where unitless numbers are
 * free (a count, a grid line, a unitless flex or transform factor). A number written as px, a
 * runtime string, a number in a token domain, never do. `text` is the number as it is written
 * (`1px` or `1`), so the unit decision is the writer's, as for a literal.
 */
export function runtimeFits({ runtime, text }, prop, domainName) {
  if (domainName === 'custom') return true;
  if (runtime !== 'number') return false;
  const unitless = valueParser.unit(text)?.unit === '';
  if (domainName === 'free' || DOMAINS[domainName].shape) return unitless;
  return unitless && Boolean(DOMAINS[domainName].unitless);
}

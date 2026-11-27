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
  RUNTIME_SOURCES,
  RUNTIME_TOKEN_FAMILIES,
  SYSTEM_COLORS,
  TOKEN_CONSTANTS,
  TOKEN_PUBLISHER,
} from './registry.mjs';

const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;
const IDENT = /^-?[a-z_][\w-]*$/i;

export const valueMessages = {
  measure: (word, prop) =>
    `\`${word}\` is not allowed in \`${prop}\`: it takes keywords and counts only (UI gate S1).`,
  property: (prop) => `\`${prop}\` is not a registered property (UI gate S1).`,
  url: (target, graph) =>
    `\`url(${target})\` references what the gate does not check: ${
      graph
        ? 'reference a registered asset by a relative path (`./x.svg`), which the bundle graph follows, or a fragment of the document (`#id`)'
        : 'an inline value may reference only a fragment of the document (`#id`); reference an asset from a stylesheet'
    } (UI gate S1, §3).`,
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
    `This \`${prop}\` value is ${kind === 'expression' ? 'an expression (a binding, member, call, operator, branch or template with substitutions)' : `a runtime ${kind}`}: only its write site is read, and an expression there is not shown to be a token. Write a token here (\`var(--token)\`, a registered token constant), or write the computed value into a custom property through a registered runtime source (\`style={{ '--x': runtimeStyle(v) }}\`) and read it in a stylesheet with \`var(--x)\` (UI gate E4, D15 ②).`,
  tokenConstant: (prop, name) =>
    `\`${name}\` is not a member of a token constant registered for the domain of \`${prop}\` (scripts/ui-lint/registry.mjs TOKEN_CONSTANTS): write \`var(--token)\` here or register the constant (UI gate E4, D15 ②).`,
  wrapped: (prop, name) =>
    `\`${name}\` is not a registered runtime source for \`${prop}\`: a runtime value is written only into a custom property, only through a source registered in scripts/ui-lint/registry.mjs RUNTIME_SOURCES (\`style={{ '--x': runtimeStyle(v) }}\`, read by \`var(--x)\` in a stylesheet) (UI gate E4, D15 ②).`,
  styleObject: () =>
    `This style object is not an object literal where it is written: none of its values can be shown to be tokens, so write the object literal here (UI gate E4, D15).`,
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
function valueProblems(
  value,
  prop,
  domainName,
  { forced = false, keyframes = new Set(), urls = 'fragment' } = {},
) {
  const problems = [];
  const animation = ANIMATION_NAMES.has(prop.replace(VENDOR_PREFIX, ''));
  const problem = (node, message) =>
    problems.push({ index: node.sourceIndex, endIndex: node.sourceEndIndex, message });

  // `unitless`: `true`, or the functions and properties in which a plain number is a factor.
  const unitless = (domain, fn) =>
    domain.unitless === true ||
    Boolean(domain.unitless?.functions.includes(fn) || domain.unitless?.properties.includes(prop));
  const atom = (node, domain, inMath, fn) => {
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
      if (number.unit === '') return !inMath && unitless(domain, fn);
      return Boolean(domain.units?.includes(number.unit.toLowerCase()));
    }
    if (!domain.idents || text.startsWith('#') || !IDENT.test(text)) return false;
    if (animation && !ANIMATION_KEYWORDS.has(lower) && !keyframes.has(text)) {
      problem(node, valueMessages.keyframes(text));
    }
    return true;
  };

  /**
   * What `url()` may reference (P1 QA17 F5): a fragment of the document (`url(#g)`, a gradient
   * or filter whose own values are checked where it is written) anywhere; a relative path
   * (`./x.svg`) only in a stylesheet (`urls: 'graph'`), where the bundle graph follows it to a
   * registered asset as an edge. Anything else (`data:`, a remote or absolute URL, a path in an
   * inline value, which the page fetches from its own address outside the graph) is reported:
   * its content is not checked.
   */
  const reference = (node) => {
    const argument = node.nodes.find((child) => child.type !== 'space');
    const target = argument?.type === 'word' || argument?.type === 'string' ? argument.value : '';
    if (/^#[\w-]+$/.test(target)) return;
    if (urls === 'graph' && /^\.{1,2}\//.test(target)) return;
    problem(node, valueMessages.url(target, urls === 'graph'));
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
      else if (REFERENCES.has(node.value.toLowerCase())) reference(node);
      else registeredOnly(node.nodes);
    }
  };

  /** Walk value nodes in a token domain: every word is an atom of it. */
  const walk = (nodes, domain, name, inMath = false, fn = undefined) => {
    for (const node of nodes) {
      if (node.type === 'space' || node.type === 'comment' || node.type === 'div') continue;
      if (node.type === 'string') {
        problem(node, valueMessages.atom(`"${node.value}"`, prop, name));
        continue;
      }
      if (node.type === 'word' || node.type === 'unicode-range') {
        if (!atom(node, domain, inMath, fn))
          problem(node, valueMessages.atom(node.value, prop, name));
        continue;
      }
      const lower = node.value.toLowerCase();
      if (lower === '') {
        walk(node.nodes, domain, name, inMath, fn);
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
      if (REFERENCES.has(lower)) {
        reference(node);
        continue;
      }
      // Math reads its operands as atoms; a domain function (gradient, filter, easing) its arguments.
      walk(node.nodes, domain, name, inMath || MATH.has(lower), MATH.has(lower) ? fn : node.value);
    }
  };

  const nodes = valueParser(value).nodes;
  if (domainName === 'free') registeredOnly(nodes);
  else walk(nodes, DOMAINS[domainName], domainName);
  return problems;
}

/**
 * The one verdict on a style value (plan v3.9 §2 E4, P1 QA13): every entry point that writes a
 * value — a stylesheet declaration or `@supports` test, a JSX `style` or SVG presentation
 * attribute, a `CSSProperties` object, `el.style.x =`, `setProperty`, `setAttribute`, `animate`
 * keyframes and options — hands what it read here, and nothing else decides that a value passes.
 * A value passes only when it is shown to be tokens: every reading is a literal that the domain
 * of `prop` allows, a runtime value written into a custom property (the one channel by which a
 * computed value reaches CSS: the stylesheet that reads it through `var()` is checked as any
 * other), or the registered source. Everything else is reported: an unregistered property, a
 * runtime value anywhere else, a whole style object that is not written out, and an entry point
 * that hands no reading at all is a defect of the gate, thrown.
 *
 * `readings`: what `written.mjs` reads at a TSX write site — `{ text }` (a literal as written),
 * `{ token, path }`, `{ wrapped }`, `{ runtime: 'expression' | 'object' }` — or `{ registered:
 * file }` (a write by `file`, which passes only when it is the registered token publisher
 * writing one of its families). Returns `[{ messageId: 'value' | 'untracked', message, index?,
 * endIndex? }]`
 * (`index` into a literal's text). `options.domain` names the domain when `prop` is a label
 * (a custom property in a sheet, a keyframe offset); `forced` and `keyframes` are the
 * stylesheet context `valueProblems` takes.
 */
export function verdict(
  readings,
  prop,
  {
    domain = prop === null ? undefined : domainOf(prop),
    forced,
    keyframes,
    urls,
    tokens = TOKEN_CONSTANTS,
    runtimeSources = RUNTIME_SOURCES,
  } = {},
) {
  if (prop === null) {
    // A whole style object (`prop` null) is only ever a runtime object reading: rejected.
    if (readings.some((reading) => reading.runtime !== 'object'))
      throw new Error('UI gate E4: a style object reading must be a runtime object');
    return readings.map(() => ({
      messageId: 'untracked',
      message: valueMessages.styleObject(),
    }));
  }
  if (domain === undefined) return [{ messageId: 'value', message: valueMessages.property(prop) }];
  if (readings.length === 0)
    throw new Error(`UI gate E4: no reading of \`${prop}\` was handed to the verdict`);
  const rejected = [];
  for (const reading of readings) {
    if (reading.registered !== undefined) {
      // The one registered runtime source: `colors.ts` publishing its token families.
      if (
        reading.registered === TOKEN_PUBLISHER &&
        RUNTIME_TOKEN_FAMILIES.some((family) => prop.startsWith(family))
      )
        continue;
      rejected.push({
        messageId: 'untracked',
        message: valueMessages.runtime(prop, 'value'),
      });
      continue;
    }
    if (reading.token !== undefined) {
      const tokenDomain = tokens.get(reading.token);
      if (tokenDomain !== undefined && (domain === 'custom' || domain === tokenDomain)) continue;
      rejected.push({
        messageId: 'untracked',
        message: valueMessages.tokenConstant(prop, `${reading.token}.${reading.path.join('.')}`),
      });
      continue;
    }
    if (reading.wrapped !== undefined) {
      if (runtimeSources.has(reading.wrapped) && domain === 'custom') continue;
      rejected.push({
        messageId: 'untracked',
        message: valueMessages.wrapped(prop, reading.wrapped),
      });
      continue;
    }
    if (reading.runtime !== undefined) {
      if (reading.runtime !== 'expression')
        throw new Error(`UI gate E4: a \`${prop}\` reading is a runtime ${reading.runtime}`);
      rejected.push({
        messageId: 'untracked',
        message: valueMessages.runtime(prop, reading.runtime),
      });
      continue;
    }
    if (typeof reading.text !== 'string')
      throw new Error(
        `UI gate E4: a reading of \`${prop}\` has no kind: ${JSON.stringify(reading)}`,
      );
    for (const problem of valueProblems(reading.text, prop, domain, { forced, keyframes, urls }))
      rejected.push({
        messageId: 'value',
        message: problem.message,
        index: problem.index,
        endIndex: problem.endIndex,
      });
  }
  return rejected;
}

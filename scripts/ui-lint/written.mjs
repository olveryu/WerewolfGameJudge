/**
 * What a TSX write site shows by its syntax alone (UI drift lock plan v3.12, §2 E4, D15 ②).
 *
 * The gate does not follow a value to where it came from: a binding, a member, a call, a branch,
 * a spread or a computed template is a runtime value wherever it is written, however it was
 * assigned. A value passes only when the write site itself is one of four forms: a literal the
 * value checker (`verdict`) allows (`var(--token)`, a registered keyword, `0`), a direct member
 * of a registered token constant (`tokens.space.md`), or a call to a registered runtime source
 * (`runtimeStyle(x)`, which `verdict` passes only into a custom property). A key or name passes
 * only when it is written out. Following values through a program's data flow cannot be shown
 * complete (every escape of a reference is another case to enumerate); a list of syntax kinds
 * can, because the kinds are finite and every other kind is rejected. So this module reads only
 * ESTree nodes and where an identifier is imported from (`importOf`), never a type.
 */

/** Wrappers that change no runtime value: `'x' as const`, `v satisfies T`, `v!`. */
const TRANSPARENT = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

export const strip = (node) => {
  let inner = node;
  while (TRANSPARENT.has(inner.type)) inner = inner.expression;
  return inner;
};

/**
 * The static member path below an imported binding (`tokens.space.md` → `tokens#space.md` with
 * `importOf(tokens)` = `{ module, name: 'tokens' }`; a namespace import names its first member
 * as the export), or null when any step is computed, optional or not rooted in an import.
 */
function importedPath(node, importOf) {
  const steps = [];
  let inner = node;
  while (inner.type === 'MemberExpression') {
    if (inner.computed || inner.optional || inner.property.type !== 'Identifier') return null;
    steps.unshift(inner.property.name);
    inner = inner.object;
  }
  if (inner.type !== 'Identifier') return null;
  const source = importOf(inner);
  if (source === null) return null;
  if (source.name !== '*') return { key: `${source.module}#${source.name}`, path: steps };
  if (steps.length === 0) return null;
  return { key: `${source.module}#${steps[0]}`, path: steps.slice(1) };
}

/**
 * The reading of a value as written: `{ text }` for a string literal, a template with
 * no substitution, or a number (signed by a leading `-`) as CSS through `unit`;
 * `{ token: key, path }` for a static member path below an import (`verdict` passes it
 * only when `key` is a registered token constant with members); `{ wrapped: key }` for
 * a call whose callee is an imported binding (`verdict` passes it only when `key` is a
 * registered runtime source and the property is custom); anything else is
 * `{ runtime: 'expression' }`, which never passes. `importOf(identifier)` is
 * `{ module, name }` (`name` `*` for a namespace import) or null.
 */
export function writtenValue(node, unit, importOf) {
  const value = strip(node);
  if (value.type === 'MemberExpression') {
    const imported = importedPath(value, importOf);
    if (imported !== null && imported.path.length > 0)
      return { token: imported.key, path: imported.path };
  }
  if (value.type === 'CallExpression' && !value.optional) {
    const imported = importedPath(value.callee, importOf);
    if (imported !== null && imported.path.length === 0) return { wrapped: imported.key };
  }
  if (value.type === 'Literal' && typeof value.value === 'string') return { text: value.value };
  if (value.type === 'Literal' && typeof value.value === 'number')
    return { text: unit(value.value) };
  if (
    value.type === 'UnaryExpression' &&
    value.operator === '-' &&
    value.argument.type === 'Literal' &&
    typeof value.argument.value === 'number'
  )
    return { text: unit(-value.argument.value) };
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0)
    return { text: value.quasis[0].value.cooked };
  return { runtime: 'expression' };
}

/**
 * The key of an object property or member as written (`width`, `'--x'`, `['--x']`, `[0]`), or
 * null when it is computed from anything but a literal.
 */
export function writtenKey(key, computed) {
  if (!computed && key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number'))
    return String(key.value);
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0)
    return key.quasis[0].value.cooked;
  return null;
}

/**
 * A property or attribute name passed as an argument (`setProperty`, `setAttribute`): the name
 * written out, a custom property prefix written before a substitution (`` `--seat-${i}` ``
 * gives the prefix `--seat-`), or null.
 */
export function writtenName(node) {
  const name = strip(node);
  if (name.type === 'Literal' && typeof name.value === 'string') return { name: name.value };
  if (name.type === 'TemplateLiteral') {
    if (name.expressions.length === 0) return { name: name.quasis[0].value.cooked };
    const head = name.quasis[0].value.cooked;
    if (head.startsWith('--') && head.length > 2) return { prefix: head };
  }
  return null;
}

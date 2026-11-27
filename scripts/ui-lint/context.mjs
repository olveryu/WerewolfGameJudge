/**
 * Where in its file a violation sits, for its fingerprint (P1 QA11 F4): the chain of enclosing
 * rules and at-rules of a stylesheet, or of enclosing elements, functions, declarations and
 * object keys of a script. A line moved into another selector, element or component is new debt,
 * so fixing an old violation cannot pay for the same text added elsewhere in the file.
 */
import postcss from 'postcss';
import ts from 'typescript';

const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** `(line, column) => chain` over a parsed stylesheet. */
export function styleContext(text, file) {
  const root = postcss.parse(text, { from: file });
  const offsets = lineOffsets(text);
  return (line, column) => {
    const at = offsets[line - 1] + column - 1;
    let chain = [];
    // The innermost node containing the position decides; its ancestors name it.
    root.walk((node) => {
      if (node.type !== 'rule' && node.type !== 'atrule') return;
      const { start, end } = node.source;
      if (start.offset <= at && at < end.offset) chain = ancestry(node);
    });
    return chain.join(' > ');
  };
}

function ancestry(node) {
  const chain = [];
  for (let current = node; current.type !== 'root'; current = current.parent)
    chain.unshift(
      current.type === 'rule'
        ? squash(current.selector)
        : squash(`@${current.name} ${current.params}`),
    );
  return chain;
}

function lineOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1)
    if (text[index] === '\n') offsets.push(index + 1);
  return offsets;
}

/** `(line, column) => chain` over a parsed script. */
export function scriptContext(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return (line, column) => {
    const at = source.getPositionOfLineAndCharacter(line - 1, column - 1);
    const chain = [];
    let node = source;
    // Descend to the innermost node that contains the position, naming the scopes on the way.
    for (;;) {
      const inner = node
        .getChildren(source)
        .find((child) => child.getStart(source) <= at && at < child.getEnd());
      if (inner === undefined) break;
      node = inner;
      const name = scopeName(node, source);
      if (name !== null) chain.push(name);
    }
    return chain.join(' > ');
  };
}

function scopeName(node, source) {
  // An element is named once: by its opening tag, whether the position is in it or its children.
  if (ts.isJsxElement(node)) return elementName(node.openingElement, source);
  if (ts.isJsxSelfClosingElement(node)) return elementName(node, source);
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isEnumMember(node)
  )
    // An anonymous default export has no name: its scope is the module's own.
    return node.name === undefined ? null : squash(node.name.getText(source));
  return null;
}

/** `<tag>` or `<tag.className>` for a literal class name. */
function elementName(node, source) {
  const className = node.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(source) === 'className' &&
      attribute.initializer !== undefined &&
      ts.isStringLiteral(attribute.initializer),
  );
  const tag = node.tagName.getText(source);
  return className === undefined ? `<${tag}>` : `<${tag}.${className.initializer.text}>`;
}

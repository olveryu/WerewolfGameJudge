/**
 * Contract test: DrawingCanvas wrapper pass-through.
 *
 * DrawingCanvas takes 13 props. `DrawingCanvasGameProps` omits exactly the
 * 5 game-supplied props; the two game wrappers (pictionary, drawguess) are
 * typed with it, spread it through, and supply the 5 game-specific props
 * themselves. If the shared canvas gains a prop, it flows to both wrappers
 * through the shared type; if a wrapper stops spreading or supplies a
 * different set, this test fails.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

const SRC = join(__dirname, '..');

const GAME_SUPPLIED_PROPS = [
  'accessibilityLabel',
  'canvasBackground',
  'createElementPath',
  'gameName',
  'testID',
] as const;

const WRAPPERS = [
  { file: 'games/pictionary/room/components/PictionaryDrawingCanvas.tsx' },
  { file: 'games/drawguess/room/components/DrawGuessDrawingCanvas.tsx' },
] as const;

function parseFile(relativePath: string): ts.SourceFile {
  const fullPath = join(SRC, relativePath);
  return ts.createSourceFile(
    fullPath,
    readFileSync(fullPath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function getInterfaceMembers(source: ts.SourceFile, interfaceName: string): string[] {
  const members: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member)) members.push(member.name.getText());
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return members;
}

/** The string-literal keys of a `type X = Omit<Y, 'a' | 'b'>` alias. */
function getOmittedKeys(source: ts.SourceFile, aliasName: string): string[] {
  const keys: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === aliasName &&
      ts.isTypeReferenceNode(node.type) &&
      node.type.typeName.getText() === 'Omit' &&
      node.type.typeArguments?.length === 2
    ) {
      const keysNode = node.type.typeArguments[1];
      if (keysNode === undefined) throw new Error(`${aliasName} has no omitted-keys argument`);
      const literals = ts.isUnionTypeNode(keysNode) ? keysNode.types : [keysNode];
      for (const literal of literals) {
        if (ts.isLiteralTypeNode(literal) && ts.isStringLiteral(literal.literal)) {
          keys.push(literal.literal.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

function getJsxAttributes(
  source: ts.SourceFile,
  tagName: string,
): { names: string[]; hasSpread: boolean } {
  const names: string[] = [];
  let hasSpread = false;
  function visit(node: ts.Node): void {
    const opening = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null;
    if (opening !== null && opening.tagName.getText() === tagName) {
      for (const attr of opening.attributes.properties) {
        if (ts.isJsxAttribute(attr)) names.push(attr.name.getText());
        if (ts.isJsxSpreadAttribute(attr)) hasSpread = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { names, hasSpread };
}

describe('DrawingCanvas props contract', () => {
  const canvasSource = parseFile('features/drawing/components/DrawingCanvas.tsx');
  const canvasProps = getInterfaceMembers(canvasSource, 'DrawingCanvasProps');
  const passThroughProps = canvasProps
    .filter((prop) => !(GAME_SUPPLIED_PROPS as readonly string[]).includes(prop))
    .sort();

  it('DrawingCanvasProps splits into 8 pass-through + 5 game-supplied props', () => {
    expect(canvasProps.length).toBe(13);
    expect(passThroughProps.length).toBe(8);
  });

  it('DrawingCanvasGameProps omits exactly the game-supplied props', () => {
    const omitted = getOmittedKeys(canvasSource, 'DrawingCanvasGameProps');
    expect([...omitted].sort()).toEqual([...GAME_SUPPLIED_PROPS]);
  });

  it.each(WRAPPERS)(
    '$file is typed with the shared game props, spreads them and supplies the rest',
    ({ file }) => {
      const source = parseFile(file);
      expect(source.getFullText()).toContain('React.FC<DrawingCanvasGameProps>');

      const { names, hasSpread } = getJsxAttributes(source, 'DrawingCanvas');
      expect(hasSpread).toBe(true);
      expect([...names].sort()).toEqual([...GAME_SUPPLIED_PROPS]);
    },
  );
});

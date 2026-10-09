/**
 * Contract test: DrawingCanvas wrapper pass-through.
 *
 * DrawingCanvas takes 13 props. The two game wrappers (pictionary,
 * drawguess) each declare the 8 pass-through props in their own props
 * interface and supply the 5 game-specific props themselves. If the shared
 * canvas gains a prop, both wrappers must declare/pass it — this test
 * fails until they do.
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
  {
    file: 'games/pictionary/room/components/PictionaryDrawingCanvas.tsx',
    propsInterface: 'PictionaryDrawingCanvasProps',
  },
  {
    file: 'games/drawguess/room/components/DrawGuessDrawingCanvas.tsx',
    propsInterface: 'DrawGuessDrawingCanvasProps',
  },
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

  it.each(WRAPPERS)(
    '$file declares exactly the pass-through props and supplies the rest',
    ({ file, propsInterface }) => {
      const source = parseFile(file);
      const declared = getInterfaceMembers(source, propsInterface);
      expect([...declared].sort()).toEqual(passThroughProps);

      const { names, hasSpread } = getJsxAttributes(source, 'DrawingCanvas');
      expect(hasSpread).toBe(true);
      expect([...names].sort()).toEqual([...GAME_SUPPLIED_PROPS]);
    },
  );
});

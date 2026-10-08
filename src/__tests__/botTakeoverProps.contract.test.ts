/**
 * Contract test: BotTakeoverProps shape and consumer pass-through.
 *
 * The shared BotTakeover component takes exactly 8 props. Games that render
 * it directly (discovered by scanning src/games for <BotTakeover> usage)
 * must pass every prop explicitly; a missing prop silently disables part
 * of the takeover UX (e.g. no urgency without remainingSeconds).
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

const SRC = join(__dirname, '..');

const EXPECTED_PROPS = [
  'activeSeat',
  'bots',
  'canControl',
  'controlledSeat',
  'isLobby',
  'onRelease',
  'onTakeOver',
  'remainingSeconds',
] as const;

/** Every tsx file under src/games that renders <BotTakeover> directly. */
function findDirectConsumers(): string[] {
  const gamesDir = join(SRC, 'games');
  const consumers: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
        const source = ts.createSourceFile(
          fullPath,
          readFileSync(fullPath, 'utf-8'),
          ts.ScriptTarget.Latest,
          true,
        );
        if (getJsxAttributeNames(source, 'BotTakeover').length > 0) {
          consumers.push(fullPath.replace(`${SRC}/`, ''));
        }
      }
    }
  };
  walk(gamesDir);
  return consumers.sort();
}

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

function getJsxAttributeNames(source: ts.SourceFile, tagName: string): string[] {
  const names: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === tagName) {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr)) names.push(attr.name.getText());
        if (ts.isJsxSpreadAttribute(attr)) names.push('...spread');
      }
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === tagName) {
      for (const attr of node.openingElement.attributes.properties) {
        if (ts.isJsxAttribute(attr)) names.push(attr.name.getText());
        if (ts.isJsxSpreadAttribute(attr)) names.push('...spread');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return names;
}

describe('BotTakeover props contract', () => {
  it('BotTakeoverProps has exactly the expected 8 props', () => {
    const source = parseFile('components/BotTakeover/BotTakeover.tsx');
    const members = getInterfaceMembers(source, 'BotTakeoverProps');
    expect([...members].sort()).toEqual([...EXPECTED_PROPS]);
  });

  it('every direct consumer passes every prop explicitly', () => {
    const consumers = findDirectConsumers();
    // pictionary/storyrelay stages + drawguess room render it directly today;
    // a new direct consumer must appear here automatically and comply.
    expect(consumers.length).toBeGreaterThanOrEqual(3);
    for (const consumer of consumers) {
      const source = parseFile(consumer);
      const attrs = getJsxAttributeNames(source, 'BotTakeover');
      expect(attrs).not.toContain('...spread');
      expect([...new Set(attrs)].sort()).toEqual([...EXPECTED_PROPS]);
    }
  });
});

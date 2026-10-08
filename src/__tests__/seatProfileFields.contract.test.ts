/**
 * Contract test: createSeatProfile output fields == RosterEntry fields.
 *
 * `createSeatProfile` (src/features/room) builds the profile stored for a
 * seated player; its shape is the engine's `RosterEntry`. If RosterEntry
 * gains a field, the builder must populate it (or explicitly omit it via
 * RoomProfileUpdate) — this test fails until the builder is updated.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

const REPO_ROOT = join(__dirname, '../..');

function parseFile(relativePath: string): ts.SourceFile {
  const fullPath = join(REPO_ROOT, relativePath);
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

/** Keys of the object literal returned by createSeatProfile. */
function getReturnedObjectKeys(source: ts.SourceFile, functionName: string): string[] {
  const keys: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName &&
      node.body !== undefined
    ) {
      for (const statement of node.body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression !== undefined) {
          if (ts.isObjectLiteralExpression(statement.expression)) {
            for (const prop of statement.expression.properties) {
              if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                keys.push(prop.name.getText());
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

describe('seat profile fields contract', () => {
  it('createSeatProfile returns exactly the RosterEntry fields', () => {
    const rosterSource = parseFile('packages/game-engine/src/platform/room/roster.ts');
    const rosterFields = getInterfaceMembers(rosterSource, 'RosterEntry');

    const builderSource = parseFile('src/features/room/model/createSeatProfile.ts');
    const returnedKeys = getReturnedObjectKeys(builderSource, 'createSeatProfile');

    expect([...returnedKeys].sort()).toEqual([...rosterFields].sort());
  });
});

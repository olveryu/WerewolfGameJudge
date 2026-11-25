import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { getAllRoleIds } from '@game-judge/game-engine/games/werewolf/public';
import ts from 'typescript';

const WEB_SOURCE = join(import.meta.dirname, '../../../..');
const STEP_DIRECTORY = join(WEB_SOURCE, 'features/room/steps');
const WEREWOLF_NIGHT_HOOK = join(import.meta.dirname, '../hooks/useWerewolfNightInteraction.ts');
const WEREWOLF_ROOM_SCREEN = join(import.meta.dirname, '../WerewolfRoomScreen.tsx');
const WEREWOLF_ROOM_DIRECTORY = join(import.meta.dirname, '..');
const NIGHT_COMPOSITION = [
  {
    file: join(import.meta.dirname, '../werewolfRoomAdapter.ts'),
    functions: [
      'createWerewolfSeatDataSource',
      'deriveWerewolfBottomProgress',
      'createWerewolfStepActionList',
      'createWerewolfPlayerActions',
      'createWerewolfRoomShellModel',
    ],
  },
  {
    file: join(import.meta.dirname, '../hooks/useWerewolfRoomState.ts'),
    functions: ['useWerewolfRoomState'],
  },
];

function productionStepFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : productionStepFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [file] : [];
  });
}

describe('Werewolf night client architecture', () => {
  it('renders step presentations without mentioning concrete role IDs', () => {
    const roleIds = new Set<string>(getAllRoleIds());
    const violations: string[] = [];
    const sources = [
      ...[
        WEREWOLF_NIGHT_HOOK,
        WEREWOLF_ROOM_SCREEN,
        ...productionStepFiles(STEP_DIRECTORY),
        ...productionStepFiles(WEREWOLF_ROOM_DIRECTORY).filter(
          (file) => !NIGHT_COMPOSITION.some((entry) => entry.file === file),
        ),
      ].map((file) => ({ file, functions: null })),
      ...NIGHT_COMPOSITION,
    ];
    for (const { file, functions } of sources) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
      const visit = (node: ts.Node): void => {
        const roleId = ts.isStringLiteralLike(node)
          ? node.text
          : ts.isPropertyAccessExpression(node) &&
              !(
                node.name.text === 'wolf' &&
                ts.isIdentifier(node.expression) &&
                (node.expression.text === 'buckets' || node.expression.text === 'items')
              )
            ? node.name.text
            : null;
        if (roleId !== null && roleIds.has(roleId)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          violations.push(`${relative(WEB_SOURCE, file)}:${line}: ${roleId}`);
        }
        ts.forEachChild(node, visit);
      };
      if (functions === null) {
        visit(source);
        continue;
      }
      for (const name of functions) {
        const declaration = source.statements.find(
          (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
        );
        if (declaration === undefined) {
          throw new Error(`[FAIL-FAST] Missing night composition function ${name} in ${file}`);
        }
        visit(declaration);
      }
    }
    expect(violations).toEqual([]);
  });
});

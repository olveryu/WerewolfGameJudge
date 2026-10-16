/**
 * Contract test: the room guidance surfaces stay merged (PR-A of the room
 * guidance redesign).
 *
 * The top status ribbon, the next-step strip model and the disabled-press
 * popup channel were removed as mechanisms: host guidance is one action
 * data set rendered two ways (collapsed console + expanded panel), step
 * progress travels inside the bottom-actions model, and a disabled
 * action's reason renders as a caption where the action sits. These
 * identifiers must not reappear in room production code.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SCAN_ROOTS = [join(__dirname, '../features/room'), join(__dirname, '../games')];

const FORBIDDEN_PATTERNS: readonly { readonly pattern: RegExp; readonly label: string }[] = [
  { pattern: /StatusRibbon/, label: 'status ribbon (component, model or factory)' },
  { pattern: /buildRoomNextStep/, label: 'buildRoomNextStep derivation' },
  { pattern: /RoomNextStep/, label: 'RoomNextStep model types' },
  { pattern: /messageRibbon|progressRibbon/, label: 'ribbon model factories' },
  { pattern: /buildLobbyWaitingText/, label: 'lobby waiting ribbon text' },
  { pattern: /HostGuideBanner/, label: 'host guide banner' },
  { pattern: /onDisabledPress/, label: 'disabled-press popup channel' },
  { pattern: /长按座位可接管机器人/, label: 'takeover hint copy' },
];

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function isProductionFile(file: string): boolean {
  return !file.includes('__tests__') && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx');
}

describe('room guidance surfaces contract', () => {
  it('no removed guidance mechanism identifier survives in room production code', () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of getAllTsFiles(root)) {
        if (!isProductionFile(file)) continue;
        const source = readFileSync(file, 'utf-8');
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          if (pattern.test(source)) {
            violations.push(`${file.replace(join(__dirname, '..'), 'src')}: ${label}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the host management model carries no preview, status or next-step fields', () => {
    const model = readFileSync(
      join(__dirname, '../features/room/model/RoomHostManagement.ts'),
      'utf-8',
    );
    expect(model).not.toMatch(/readonly preview:/);
    expect(model).not.toMatch(/readonly status:/);
    expect(model).not.toMatch(/readonly nextStep:/);
    expect(model).toMatch(/readonly isPrimary\?: boolean;/);
    expect(model).toMatch(/readonly remedy\?: RoomHostRemedy \| null;/);
  });

  it('the shell model carries no status ribbon slot', () => {
    const shellModel = readFileSync(
      join(__dirname, '../features/room/model/RoomShellModel.ts'),
      'utf-8',
    );
    expect(shellModel).not.toMatch(/statusRibbon/);
    expect(shellModel).toMatch(/readonly bottomActions: RoomBottomActionModel;/);
  });
});

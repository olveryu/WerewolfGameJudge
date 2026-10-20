/**
 * Host Flow Vocabulary — chassis contract (D-3).
 *
 * The host panel's flow actions are chassis standard parts: one
 * constructor set, one vocabulary, one confirm shape, distributed by
 * the generator templates. These pins keep the forked vocabularies
 * (per-game start/assign/abort/next-round wordings, the label
 * override hatch, hand-written terminal descriptors) from regrowing.
 * Game content (confirm bodies carrying the game's own nouns, rules
 * copy, encyclopedia text) is out of scope and never scanned here.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');

function readSource(relativePath: string): string {
  const fullPath = join(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

/** Assembly + flow-hook files that carry host-flow vocabulary. */
const HOST_FLOW_FILES = [
  'src/games/werewolf/room/createWerewolfHostManagement.ts',
  'src/games/werewolf/room/useWerewolfHostControl.ts',
  'src/games/avalon/room/avalonRoomAdapter.ts',
  'src/games/demo/room/demoRoomAdapter.ts',
  'src/games/fibking/room/fibRoomAdapter.ts',
  'src/games/fibking/room/hooks/useFibRoomScreenState.ts',
  'src/games/undercover/room/undercoverRoomAdapter.ts',
  'src/games/undercover/room/hooks/useUndercoverRoundControls.ts',
  'src/games/pictionary/room/pictionaryRoomAdapter.ts',
  'src/games/pictionary/room/hooks/usePictionaryRoomScreenState.ts',
  'src/games/storyrelay/room/storyRelayRoomAdapter.ts',
  'src/games/drawguess/room/drawGuessRoomAdapter.ts',
  'scripts/lib/new-game/templates/identity/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
  'scripts/lib/new-game/templates/stage/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
] as const;

/** Forked flow vocabulary that must never reappear in the files above. */
const FORBIDDEN_VOCABULARY = [
  "'开始本轮'",
  '开始本轮？',
  '开始本局？',
  "label: '开始本局'",
  "submit('开始本局'",
  "'再来一轮'",
  "'下一轮'",
  '开始下一轮',
  "'放弃游戏'",
  '放弃游戏？',
  "'结束游戏'",
  '结束游戏？',
  "'房主操作'",
  '中止本轮？',
  "label: '分配身份'",
  "submit('分配身份'",
  "'分配身份？'",
  '还有玩家未查看',
] as const;

describe('host flow vocabulary — one chassis vocabulary', () => {
  it('no host-flow file carries a forked flow vocabulary', () => {
    for (const file of HOST_FLOW_FILES) {
      const source = readSource(file);
      for (const word of FORBIDDEN_VOCABULARY) {
        expect({ file, word, present: source.includes(word) }).toEqual({
          file,
          word,
          present: false,
        });
      }
    }
  });

  it('the shared builders expose no label override hatch', () => {
    const source = readSource('src/features/room/model/hostManagementActions.ts');
    expect(source).not.toMatch(/input\.label/);
    expect(source).not.toMatch(/readonly label\?:/);
    expect(source).toMatch(/export function buildAssignRolesAction/);
    expect(source).toMatch(/export function buildAbortGameAction/);
    expect(source).toMatch(/export function buildRestartGameAction/);
    expect(source).toMatch(/export const HOST_FLOW_CONFIRM/);
  });

  it('every game with a deal step assembles it through buildAssignRolesAction', () => {
    for (const file of [
      'src/games/werewolf/room/createWerewolfHostManagement.ts',
      'src/games/avalon/room/avalonRoomAdapter.ts',
      'src/games/demo/room/demoRoomAdapter.ts',
      'src/games/fibking/room/fibRoomAdapter.ts',
      'src/games/undercover/room/undercoverRoomAdapter.ts',
      'scripts/lib/new-game/templates/identity/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
    ]) {
      expect({ file, present: readSource(file).includes('buildAssignRolesAction({') }).toEqual({
        file,
        present: true,
      });
    }
  });

  it('every ended assembly offers the chassis terminal pair through the shared builders', () => {
    for (const file of [
      'src/games/avalon/room/avalonRoomAdapter.ts',
      'src/games/demo/room/demoRoomAdapter.ts',
      'src/games/fibking/room/fibRoomAdapter.ts',
      'src/games/undercover/room/undercoverRoomAdapter.ts',
      'src/games/pictionary/room/pictionaryRoomAdapter.ts',
      'src/games/storyrelay/room/storyRelayRoomAdapter.ts',
      'src/games/drawguess/room/drawGuessRoomAdapter.ts',
      'scripts/lib/new-game/templates/identity/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
      'scripts/lib/new-game/templates/stage/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
    ]) {
      const source = readSource(file);
      expect({
        file,
        builder: 'buildNextRoundAction',
        present: source.includes('buildNextRoundAction({'),
      }).toEqual({
        file,
        builder: 'buildNextRoundAction',
        present: true,
      });
      expect({
        file,
        builder: 'buildReturnLobbyAction',
        present: source.includes('buildReturnLobbyAction({'),
      }).toEqual({
        file,
        builder: 'buildReturnLobbyAction',
        present: true,
      });
    }
  });

  it('pictionary no longer assembles flow actions through a local helper', () => {
    const source = readSource('src/games/pictionary/room/pictionaryRoomAdapter.ts');
    expect(source).not.toMatch(/function hostAction\(/);
  });

  it('config saves dispatch under the one chassis label', () => {
    for (const file of [
      'src/games/fibking/screens/ConfigScreen/useFibConfigScreenState.ts',
      'src/games/pictionary/screens/ConfigScreen/usePictionaryConfigScreenState.ts',
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/update[A-Z]\w*Config/);
      expect(source.includes("label: '保存设置'")).toBe(true);
    }
  });
});

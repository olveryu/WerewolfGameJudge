/** Werewolf board release metadata shown in the product announcement modal. */

import type { PresetTemplate } from '@game-judge/game-engine/games/werewolf/public';

const WEREWOLF_BOARD_VERSION_BY_NAME: Readonly<Record<string, string>> = {
  预女猎白: 'v1.0.0',
  狼美守卫: 'v1.0.0',
  狼王守卫: 'v1.0.0',
  白狼王守卫: 'v1.0.0',
  石像鬼守墓人: 'v1.0.0',
  噩梦之影守卫: 'v1.0.0',
  血月猎魔: 'v1.0.0',
  狼王摄梦人: 'v1.0.0',
  狼王魔术师: 'v1.0.0',
  机械狼人通灵师: 'v1.0.0',
  恶灵骑士: 'v1.0.0',
  纯白夜影: 'v1.2.0',
  灯影预言家: 'v1.2.0',
  假面舞会: 'v1.2.0',
  吹笛者: 'v1.2.0',
  预女猎白混: 'v1.0.0',
  预女猎白野: 'v1.2.0',
  盗宝大师: 'v2.0.0',
  盗贼丘比特: 'v2.0.0',
  咒狐乌鸦: 'v2.0.0',
  影子复仇者: 'v2.0.0',
  唯邻是从: 'v2.1.0',
  孤注一掷: 'v2.1.0',
  永序之轮: 'v2.2.0',
  隐狼乌鸦: 'v2.5.0',
  种狼骑士: 'v2.7.0',
};

export const WEREWOLF_BOARD_VERSIONS_DESC = [
  'v2.7.0',
  'v2.5.0',
  'v2.2.0',
  'v2.1.0',
  'v2.0.0',
  'v1.2.0',
  'v1.0.0',
] as const;

export interface WerewolfBoardsByVersion {
  readonly version: string;
  readonly boards: readonly PresetTemplate[];
}

export function getWerewolfBoardsByVersion(
  templates: readonly PresetTemplate[],
): readonly WerewolfBoardsByVersion[] {
  const templateNames = new Set(templates.map((template) => template.name));
  const versions = new Set<string>(WEREWOLF_BOARD_VERSIONS_DESC);

  for (const boardName of Object.keys(WEREWOLF_BOARD_VERSION_BY_NAME)) {
    if (!templateNames.has(boardName)) {
      throw new Error(`[FAIL-FAST] Werewolf board release metadata references ${boardName}`);
    }
  }

  const grouped = new Map<string, PresetTemplate[]>();
  for (const version of WEREWOLF_BOARD_VERSIONS_DESC) grouped.set(version, []);

  for (const template of templates) {
    const version = WEREWOLF_BOARD_VERSION_BY_NAME[template.name];
    if (version === undefined) {
      throw new Error(`[FAIL-FAST] Missing Werewolf board release version for ${template.name}`);
    }
    if (!versions.has(version)) {
      throw new Error(`[FAIL-FAST] Unknown Werewolf board release version ${version}`);
    }
    const boards = grouped.get(version);
    if (boards === undefined) {
      throw new Error(`[FAIL-FAST] Missing Werewolf board group ${version}`);
    }
    boards.push(template);
  }

  return WEREWOLF_BOARD_VERSIONS_DESC.map((version) => {
    const boards = grouped.get(version);
    if (boards === undefined || boards.length === 0) {
      throw new Error(`[FAIL-FAST] Werewolf board release version ${version} is empty`);
    }
    return { version, boards };
  });
}

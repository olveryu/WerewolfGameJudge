/**
 * 阿瓦隆角色技能介绍：复用现有展示名/阵营，只补 description。
 * 展示名统一用 model/avalonRoleDisplay.ts（忠臣/爪牙），不另起一套。
 */

import { type AvalonRoleId, isAvalonEvilRole } from '@game-judge/game-engine/games/avalon/public';

import { getAvalonFactionDisplayName, getAvalonRoleDisplayName } from './avalonRoleDisplay';

export interface AvalonRoleMeta {
  readonly roleId: AvalonRoleId;
  readonly displayName: string;
  readonly factionName: string;
  readonly isEvil: boolean;
  readonly description: string;
}

const AVALON_ROLE_DESCRIPTIONS: Readonly<Record<AvalonRoleId, string>> = {
  merlin: '晚上能看到所有坏人（莫德雷德除外）。小心隐藏身份，别被刺客找到。',
  percival: '晚上能看到梅林和莫甘娜，但分不清谁是谁。保护梅林不被刺杀。',
  loyalServant: '普通好人，没有特殊能力。靠推理和投票帮助好人完成任务。',
  morgana: '坏人。晚上和坏人同伴互认（奥伯伦除外）。在派西维尔眼中伪装成梅林。',
  assassin: '坏人。好人完成 3 个任务后，指认梅林；指认正确坏人翻盘。',
  mordred: '坏人。梅林看不到你，是坏人阵营的隐藏王牌。',
  oberon: '坏人，但不参与坏人互认，也看不到同伴。独自行动的卧底。',
  minion: '坏人。普通的坏人爪牙，晚上参与互认和破坏任务。',
};

/** 角色完整元数据；未知 roleId 直接抛（fail-fast）。 */
export function getAvalonRoleMeta(roleId: AvalonRoleId): AvalonRoleMeta {
  const description = AVALON_ROLE_DESCRIPTIONS[roleId];
  if (description === undefined) throw new Error(`[FAIL-FAST] Unknown Avalon role ID: ${roleId}`);
  return {
    roleId,
    displayName: getAvalonRoleDisplayName(roleId),
    factionName: getAvalonFactionDisplayName(roleId),
    isEvil: isAvalonEvilRole(roleId),
    description,
  };
}

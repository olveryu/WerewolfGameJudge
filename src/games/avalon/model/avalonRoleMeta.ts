/**
 * 阿瓦隆角色技能介绍：复用现有展示名/阵营，描述为结构化字段。
 * 展示名统一用 model/avalonRoleDisplay.ts（忠臣/爪牙），不另起一套。
 * 结构化字段与狼人杀 RoleDescription 对齐：skill/passive/trigger/restriction/special/winCondition。
 */

import { type AvalonRoleId, isAvalonEvilRole } from '@game-judge/game-engine/games/avalon/public';

import { getAvalonFactionDisplayName, getAvalonRoleDisplayName } from './avalonRoleDisplay';

/** 结构化角色描述字段（与狼人杀 RoleDescription 对齐）。 */
export interface AvalonRoleDescription {
  readonly skill?: string;
  readonly passive?: string;
  readonly trigger?: string;
  readonly restriction?: string;
  readonly special?: string;
  readonly winCondition?: string;
}

export interface AvalonRoleMeta {
  readonly roleId: AvalonRoleId;
  readonly displayName: string;
  readonly factionName: string;
  readonly isEvil: boolean;
  readonly description: AvalonRoleDescription;
}

const AVALON_ROLE_DESCRIPTIONS: Readonly<Record<AvalonRoleId, AvalonRoleDescription>> = {
  merlin: {
    skill: '晚上能看到所有坏人（莫德雷德除外）。',
    restriction: '小心隐藏身份，别被刺客找到。',
    winCondition: '完成 3 个任务，且不被刺客指认。',
  },
  percival: {
    skill: '晚上能看到梅林和莫甘娜，但分不清谁是谁。',
    special: '保护梅林不被刺杀。',
    winCondition: '完成 3 个任务，且梅林不被刺杀。',
  },
  loyalServant: {
    passive: '普通好人，没有特殊能力。',
    special: '靠推理和投票帮助好人完成任务。',
    winCondition: '完成 3 个任务。',
  },
  morgana: {
    passive: '晚上和坏人同伴互认（奥伯伦除外）。',
    special: '在派西维尔眼中伪装成梅林。',
    winCondition: '破坏 3 个任务。',
  },
  assassin: {
    trigger: '好人完成 3 个任务后，指认一名玩家为梅林。',
    winCondition: '破坏 3 个任务，或刺杀梅林成功。',
  },
  mordred: {
    passive: '梅林看不到你。',
    special: '坏人阵营的隐藏王牌。',
    winCondition: '破坏 3 个任务。',
  },
  oberon: {
    passive: '不参与坏人互认，也看不到同伴。',
    special: '独自行动的卧底。',
    winCondition: '破坏 3 个任务。',
  },
  minion: {
    passive: '普通的坏人爪牙。',
    skill: '晚上参与互认，在任务中搞破坏。',
    winCondition: '破坏 3 个任务。',
  },
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

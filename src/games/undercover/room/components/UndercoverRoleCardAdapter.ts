/**
 * UndercoverRoleCardAdapter - 把卧底身份种类转成共享 RevealRoleData（BoardInfo 预览用）。
 *
 * 预览是公开信息：名称、BoardInfo 同源的阵营色、角色说明与胜利条件；
 * 文案逐字摘自规则页（UndercoverRulesScreen），不另编第二套说法。
 * 与词卡的区别：词卡按产品规则不显示所属阵营（alignment 恒 neutral），
 * 预览展示的是板子构成层面的公开分类，与 BoardInfo 分区定色一致。
 */
import type { UndercoverRole } from '@game-judge/game-engine/games/undercover/public';

import type { RevealAlignment, RevealRoleData } from '@/features/room/model/RevealRoleData';

const ROLE_NAMES: Readonly<Record<UndercoverRole, string>> = {
  civilian: '平民',
  undercover: '卧底',
  blank: '白板',
};

const ROLE_ALIGNMENTS: Readonly<Record<UndercoverRole, RevealAlignment>> = {
  civilian: 'villager',
  undercover: 'wolf',
  blank: 'neutral',
};

/** 角色说明与胜利条件：逐字摘自规则页对应条目。 */
const ROLE_DESCRIPTIONS: Readonly<
  Record<UndercoverRole, { readonly instruction: string; readonly winCondition: string }>
> = {
  civilian: {
    instruction: '与其他平民拿到相同的词，词卡不显示所属阵营。找出拿到不同词语的玩家。',
    winCondition: '没有存活白板，且卧底全部出局。',
  },
  undercover: {
    instruction: '拿到与平民相关但不同的词，词卡同样不显示所属阵营。通过描述判断局势，避免被投出。',
    winCondition: '没有存活白板，且存活卧底人数不少于存活平民人数。',
  },
  blank: {
    instruction: '没有词语，但知道自己是白板。根据其他人的描述寻找线索，争取留到最后。',
    winCondition: '白板存活且场上只剩两人时，白板独赢。白板仍在且超过两人时，继续游戏。',
  },
};

/** BoardInfo 角色行回传的是字符串 id；判断是否为合法的卧底身份种类。 */
export function isUndercoverRole(roleId: string): roleId is UndercoverRole {
  return roleId === 'civilian' || roleId === 'undercover' || roleId === 'blank';
}

/**
 * BoardInfo 角色预览数据：只有种类级公开信息——不含本局词语，
 * 不触发身份查看协议（预览不播动画、不落确认记录，与阿瓦隆/瞎掰王预览一致）。
 */
export function toUndercoverRolePreviewData(role: UndercoverRole): RevealRoleData {
  const description = ROLE_DESCRIPTIONS[role];
  return {
    id: `undercover-${role}`,
    name: ROLE_NAMES[role],
    alignment: ROLE_ALIGNMENTS[role],
    description: [
      {
        label: '角色说明',
        content: description.instruction,
        icon: 'information-circle-outline',
      },
      { label: '胜利条件', content: description.winCondition, icon: 'trophy-outline' },
    ],
  };
}

/**
 * 身份配置的表单草稿：输入框保留原始文本，提交时转换为引擎配置并用引擎规则校验。
 */

import {
  findToolboxIdentityConfigIssue,
  hasEnoughToolboxCards,
  normalizeToolboxName,
  TOOLBOX_IDENTITY_LIMITS,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';

export interface ToolboxIdentityRoleDraft {
  /** 仅用于标签与表单元素的本地稳定 ID，不进入配置。 */
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly count: string;
}

export interface ToolboxIdentityDraft {
  readonly roles: readonly ToolboxIdentityRoleDraft[];
  readonly cardsPerPlayer: string;
}

/** 校验失败的提示；`roleId` 指向需要切换到的身份标签。 */
export interface ToolboxIdentityDraftProblem {
  readonly message: string;
  readonly roleId: number | null;
}

/** 没有身份时给出一行空白身份，与预览确认的首次配置一致。 */
export function createToolboxIdentityDraft(config: ToolboxIdentityConfig): ToolboxIdentityDraft {
  const roles =
    config.identities.length === 0
      ? [{ name: '', description: '', count: '1' }]
      : config.identities.map((identity) => ({ ...identity, count: String(identity.count) }));
  return {
    roles: roles.map((role, index) => ({ ...role, id: index + 1 })),
    cardsPerPlayer: String(config.cardsPerPlayer),
  };
}

/** 只有一行未填写的身份：载入方案时无需确认替换。 */
export function isBlankToolboxIdentityDraft(draft: ToolboxIdentityDraft): boolean {
  const [only, ...rest] = draft.roles;
  return (
    rest.length === 0 &&
    only !== undefined &&
    only.name.trim() === '' &&
    only.description.trim() === ''
  );
}

/** 十进制正整数文本转为数字；其余输入为 NaN，交给引擎规则报告。 */
export function parseToolboxCountInput(raw: string): number {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function readToolboxIdentityDraft(draft: ToolboxIdentityDraft): ToolboxIdentityConfig {
  return {
    identities: draft.roles.map((role) => ({
      name: normalizeToolboxName(role.name),
      description: role.description.trim(),
      count: parseToolboxCountInput(role.count),
    })),
    cardsPerPlayer: parseToolboxCountInput(draft.cardsPerPlayer),
  };
}

/** 摘要只统计已填写为合法整数的数量。 */
export function countToolboxDraftCards(draft: ToolboxIdentityDraft): number {
  return draft.roles.reduce((total, role) => {
    const count = parseToolboxCountInput(role.count);
    return Number.isSafeInteger(count) ? total + count : total;
  }, 0);
}

/** 用引擎的同一规则找出第一处问题，并定位到对应身份。 */
export function findToolboxIdentityDraftProblem(
  draft: ToolboxIdentityDraft,
  playerCount: number | null,
): ToolboxIdentityDraftProblem | null {
  const config = readToolboxIdentityDraft(draft);
  const issue = findToolboxIdentityConfigIssue(config);
  const roleIdAt = (index: number): number => {
    const role = draft.roles[index];
    if (role === undefined) throw new Error(`[FAIL-FAST] identity issue at missing row ${index}`);
    return role.id;
  };
  if (issue !== null) {
    switch (issue.kind) {
      case 'cardsPerPlayerInvalid':
        return {
          message: `每人抽牌数需为 1–${TOOLBOX_IDENTITY_LIMITS.maxCardsPerPlayer} 的整数。`,
          roleId: null,
        };
      case 'tooManyIdentities':
        return {
          message: `最多 ${TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes} 种身份。`,
          roleId: null,
        };
      case 'noIdentities':
        return { message: '请添加至少一种身份。', roleId: null };
      case 'nameInvalid':
        return {
          message: `请填写 1–${TOOLBOX_IDENTITY_LIMITS.nameMaxLength} 个字的身份名称。`,
          roleId: roleIdAt(issue.index),
        };
      case 'nameDuplicate':
        return { message: '身份名称不能重复，相同身份请调整数量。', roleId: roleIdAt(issue.index) };
      case 'descriptionInvalid':
        return {
          message: `身份说明最多 ${TOOLBOX_IDENTITY_LIMITS.descriptionMaxLength} 个字。`,
          roleId: roleIdAt(issue.index),
        };
      case 'countInvalid':
        return {
          message: `每种身份的数量需为 1–${TOOLBOX_IDENTITY_LIMITS.maxCountPerIdentity} 的整数。`,
          roleId: roleIdAt(issue.index),
        };
    }
  }
  if (playerCount !== null && !hasEnoughToolboxCards(config, playerCount))
    return {
      message: `身份牌不足：${playerCount} 人共需要 ${config.cardsPerPlayer * playerCount} 张。`,
      roleId: null,
    };
  return null;
}

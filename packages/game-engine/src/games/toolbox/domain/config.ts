/** 工具箱配置校验：引擎命令、Worker 方案 API 与客户端表单共用同一规则。 */

import {
  normalizeToolboxName,
  TOOLBOX_IDENTITY_LIMITS,
  TOOLBOX_TOOLS,
  type ToolboxConfig,
  type ToolboxIdentityConfig,
} from '../state/types';

export type ToolboxIdentityConfigIssue =
  | { readonly kind: 'noIdentities' }
  | { readonly kind: 'tooManyIdentities' }
  | { readonly kind: 'nameInvalid'; readonly index: number }
  | { readonly kind: 'nameDuplicate'; readonly index: number }
  | { readonly kind: 'descriptionInvalid'; readonly index: number }
  | { readonly kind: 'countInvalid'; readonly index: number }
  | { readonly kind: 'cardsPerPlayerInvalid' };

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * 返回第一个不合法之处；名称必须已规范化（去首尾空白、NFC），同名按
 * 规范化值区分大小写比较。空身份列表单独报告，因为未启用身份时允许。
 */
export function findToolboxIdentityConfigIssue(
  config: ToolboxIdentityConfig,
): ToolboxIdentityConfigIssue | null {
  if (!isIntegerInRange(config.cardsPerPlayer, 1, TOOLBOX_IDENTITY_LIMITS.maxCardsPerPlayer)) {
    return { kind: 'cardsPerPlayerInvalid' };
  }
  if (config.identities.length > TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes) {
    return { kind: 'tooManyIdentities' };
  }
  const seenNames = new Set<string>();
  for (const [index, identity] of config.identities.entries()) {
    if (
      identity.name.length === 0 ||
      identity.name !== normalizeToolboxName(identity.name) ||
      [...identity.name].length > TOOLBOX_IDENTITY_LIMITS.nameMaxLength
    ) {
      return { kind: 'nameInvalid', index };
    }
    if (seenNames.has(identity.name)) return { kind: 'nameDuplicate', index };
    seenNames.add(identity.name);
    if (
      identity.description !== identity.description.trim() ||
      [...identity.description].length > TOOLBOX_IDENTITY_LIMITS.descriptionMaxLength
    ) {
      return { kind: 'descriptionInvalid', index };
    }
    if (!isIntegerInRange(identity.count, 1, TOOLBOX_IDENTITY_LIMITS.maxCountPerIdentity)) {
      return { kind: 'countInvalid', index };
    }
  }
  if (config.identities.length === 0) return { kind: 'noIdentities' };
  return null;
}

/** 身份配置可被启用（至少一种身份且全部合法）。 */
export function isUsableToolboxIdentityConfig(config: ToolboxIdentityConfig): boolean {
  return findToolboxIdentityConfigIssue(config) === null;
}

/** 身份配置可作为草稿保存在房间：允许空列表，其余规则相同。 */
export function isStorableToolboxIdentityConfig(config: ToolboxIdentityConfig): boolean {
  const issue = findToolboxIdentityConfigIssue(config);
  return issue === null || issue.kind === 'noIdentities';
}

/** 工具列表必须去重且按 `TOOLBOX_TOOLS` 的规范顺序排列。 */
export function isCanonicalToolboxToolList(tools: readonly string[]): boolean {
  const canonical = TOOLBOX_TOOLS.filter((tool) => tools.includes(tool));
  return (
    canonical.length === tools.length && canonical.every((tool, index) => tools[index] === tool)
  );
}

/** 房间内可存储的配置（结束后工具为空亦可）。 */
export function isStorableToolboxConfig(config: ToolboxConfig): boolean {
  return (
    isCanonicalToolboxToolList(config.tools) &&
    isStorableToolboxIdentityConfig(config.identity) &&
    (!config.tools.includes('identity') || isUsableToolboxIdentityConfig(config.identity))
  );
}

/** 每人配额乘锁定人数是否能由牌堆满足；用除法避免乘法溢出。 */
export function hasEnoughToolboxCards(
  config: ToolboxIdentityConfig,
  participantCount: number,
): boolean {
  const total = config.identities.reduce((sum, identity) => sum + identity.count, 0);
  return participantCount <= Math.floor(total / config.cardsPerPlayer);
}

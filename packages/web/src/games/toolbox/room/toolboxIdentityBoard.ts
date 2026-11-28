/**
 * 身份牌的公开配置投影到共享信息卡：小标签列出名称×数量，点开共享身份卡看说明。
 * 只含公开配置，不含任何人的抽牌结果。
 */

import type { ToolboxIdentityConfig } from '@game-judge/game-engine/games/toolbox/public';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import type { DescriptionField, RevealRoleData } from '@/features/room/model/RevealRoleData';

/** 小标签的 roleId 是身份在配置中的下标，与 `config.identities` 一一对应。 */
export function createToolboxIdentityBoardSections(
  identity: ToolboxIdentityConfig,
): readonly BoardInfoSection[] {
  return [
    {
      title: '身份',
      items: identity.identities.map((definition, index) => ({
        roleId: String(index),
        displayName: definition.name,
        count: definition.count,
      })),
      tone: 'muted',
    },
  ];
}

/** 信息卡点开的身份卡：名称、数量与可选说明；房主自定义的身份没有阵营。 */
export function toToolboxIdentityPreviewData(
  identity: ToolboxIdentityConfig,
  roleId: string,
): RevealRoleData {
  const definition = identity.identities[Number(roleId)];
  if (definition === undefined)
    throw new Error(`[FAIL-FAST] Toolbox identity chip ${roleId} is outside the public config`);
  const description: DescriptionField[] = [
    { label: '数量', content: `${definition.count} 张`, icon: 'layers-outline' },
  ];
  if (definition.description !== '')
    description.push({
      label: '说明',
      content: definition.description,
      icon: 'information-circle-outline',
    });
  return {
    id: `toolbox-identity-${roleId}`,
    name: definition.name,
    alignment: 'neutral',
    description,
  };
}

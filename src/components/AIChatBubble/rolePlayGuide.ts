/**
 * rolePlayGuide - 构建角色玩法咨询 prompt
 *
 * 纯函数，无副作用。接收 roleId，输出结构化 prompt 供 AI 分析该角色的策略。
 * 不调用 service，不修改 state。
 */

import {
  getRoleSpec,
  getRoleStructuredDescription,
  type RoleId,
} from '@werewolf/game-engine/models/roles';

/**
 * 构建角色玩法咨询的 AI prompt。
 * roleId 无效时返回 null。
 */
export function buildRolePlayGuidePrompt(roleId: RoleId): string | null {
  const spec = getRoleSpec(roleId);
  if (!spec) return null;

  const desc = getRoleStructuredDescription(roleId);
  const skillText = desc?.skill ?? spec.description;

  const sections: string[] = [
    `请为"${spec.displayName}"这个角色提供实战玩法指导。`,
    '',
    `[角色信息]`,
    `- 名称：${spec.displayName}`,
    `- 阵营：${spec.faction}`,
    `- 技能：${skillText}`,
  ];

  // Add passive/special/trigger if available
  if (desc?.passive) sections.push(`- 被动：${desc.passive}`);
  if (desc?.trigger) sections.push(`- 触发：${desc.trigger}`);
  if (desc?.special) sections.push(`- 特殊：${desc.special}`);
  if (desc?.restriction) sections.push(`- 限制：${desc.restriction}`);
  if (desc?.winCondition) sections.push(`- 胜利条件：${desc.winCondition}`);

  sections.push(
    '',
    '[要求]',
    '- 结合上方"当前游戏状态"中的角色配置（如果有），给出针对本局的具体策略',
    '- 分别说明：第一夜行动建议、白天发言策略、关键注意事项',
    '- 如果是狼人阵营，额外说明如何伪装和配合队友',
    '- 简洁实用，控制在 250 字内',
  );

  return sections.join('\n');
}

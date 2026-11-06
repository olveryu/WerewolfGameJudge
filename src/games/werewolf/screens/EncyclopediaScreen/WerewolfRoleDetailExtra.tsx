/**
 * WerewolfRoleDetailExtra — 狼人杀图鉴详情 hero 的专属附加动作：AI 攻略 pill。
 *
 * 经共享详情 sheet 的 headerExtra 插槽注入；AI 桥与攻略 prompt 都是
 * 狼人杀专属依赖，不进共享图鉴机器。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getRoleSpec, isValidRoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import type { EncyclopediaRoleEntry } from '@/features/encyclopedia/encyclopediaSource';
import { buildRolePlayGuidePrompt } from '@/games/werewolf/components/AIChatBubble/rolePlayGuide';
import { requestAIChatMessage } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

/** AI 攻略 pill（AI 未就绪或角色非法时不渲染）。 */
export function WerewolfRoleDetailExtra({
  entry,
  onClose,
}: {
  readonly entry: EncyclopediaRoleEntry;
  readonly onClose: () => void;
}) {
  const roleId = isValidRoleId(entry.id) ? entry.id : null;

  const handleAskAI = useCallback(() => {
    if (!roleId) return;
    const prompt = buildRolePlayGuidePrompt(roleId);
    if (!prompt) return;
    const spec = getRoleSpec(roleId);
    const roleName = spec?.displayName ?? roleId;
    showConfirmAlert('AI 攻略', `让 AI 分析「${roleName}」的玩法？`, () => {
      onClose();
      requestAIChatMessage({
        fullText: prompt,
        displayText: `${roleName} 攻略`,
        maxTokens: 1024,
      });
    });
  }, [roleId, onClose]);

  if (roleId === null || !isAIChatReady()) return null;

  const factionColor = colors[entry.factionColorKey];
  return (
    <Pressable
      style={[styles.aiPill, { backgroundColor: withAlpha(factionColor, 0.15) }]}
      onPress={handleAskAI}
      accessibilityLabel="AI 攻略"
    >
      <Ionicons name={UI_ICONS.AI_ASSISTANT} size={typography.caption} color={factionColor} />
      <Text style={[styles.aiPillText, { color: factionColor }]}>AI 攻略</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  aiPill: {
    position: 'absolute',
    right: spacing.small,
    top: spacing.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
  },
  aiPillText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
  },
});

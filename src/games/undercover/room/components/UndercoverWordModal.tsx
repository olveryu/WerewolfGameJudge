/**
 * 词卡弹窗：迁到共享 RoleCardSimple 视觉卡（与其他游戏身份卡统一外观）。
 *
 * 身份可见性规则（产品裁决）：
 * - 白板知道自己是白板：身份行显示"白板"，大字区显示"你是白板"。
 * - 卧底/平民不知道自己的身份：身份行只显示"?"，大字区显示分到的词。
 * 卡片恒为中立灰（neutral），不暗示阵营。
 * 组件只接收查看者有权看到的 card（服务端裁剪），挂载即展示、卸载即隐藏。
 * 揭示动画走共享 RevealAnimationGate（身份查看协议）：锚点是服务端
 * confirmedSeats——本人尚未确认时首次打开才播，确认后（含回看）恒静态；
 * "我已记住"只在静态卡阶段出现。动画候选池是种类计数（公开配置），
 * 不含座位归属，不泄密。
 */
import type { UndercoverWordCard } from '@game-judge/game-engine/games/undercover/public';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { RevealAnimationGate } from '@/features/room/components/RevealAnimationGate';
import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { DescriptionField, RevealRoleData } from '@/features/room/model/RevealRoleData';
import { formatRoomSeat } from '@/features/room/model/RoomSeatDataSource';
import { spacing } from '@/theme';

interface UndercoverWordModalProps {
  readonly card: UndercoverWordCard;
  /** 卡片主人的装备揭示动画；接管机器人时为 null（D-1：动画归卡的主人）。 */
  readonly effectType?: RevealEffectType | null;
  /** 服务端锚点：该座位尚未确认词卡时为 true（首次查看才播动画）。 */
  readonly shouldPlay: boolean;
  /** 动画候选池：种类计数展开（平民/卧底/白板），来自公开配置。 */
  readonly allRoles: readonly RevealRoleData[];
  readonly isControlled: boolean;
  readonly shouldConfirm: boolean;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function UndercoverWordModal({
  card,
  effectType,
  shouldPlay,
  allRoles,
  isControlled,
  shouldConfirm,
  isSubmitting,
  onClose,
  onConfirm,
}: UndercoverWordModalProps) {
  const isBlank = card.kind === 'blank';
  const fields: DescriptionField[] = [
    { label: '身份', content: isBlank ? '白板' : '?' },
    ...(isControlled
      ? [{ label: '接管提示', content: `正在接管 ${card.seat + 1} 号 · 机器人` }]
      : []),
  ];
  const role: RevealRoleData = {
    id: 'undercover-word',
    name: isBlank ? '你是白板' : card.word,
    alignment: 'neutral',
    factionName: `${formatRoomSeat(card.seat)}词卡`,
    description: fields,
  };

  return (
    <RevealAnimationGate
      visible
      effectType={effectType ?? null}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
    >
      <RoleCardSimple
        visible={true}
        role={role}
        onClose={onClose}
        confirmText="隐藏词卡"
        testID="undercover-word-modal"
        nameTestID="undercover-word"
        descriptionTitle="身份"
        footer={
          shouldConfirm ? (
            <View style={styles.confirmFooter}>
              <Button
                variant="primary"
                size="lg"
                onPress={onConfirm}
                loading={isSubmitting}
                testID="undercover-confirm"
              >
                我已记住
              </Button>
            </View>
          ) : undefined
        }
      />
    </RevealAnimationGate>
  );
}

const styles = StyleSheet.create({
  confirmFooter: {
    width: '100%',
    marginTop: spacing.medium,
  },
});

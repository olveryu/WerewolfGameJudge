/**
 * 阿瓦隆任务结算面板：任务揭晓时刻的全员展示（与投票结算面板同范式）。
 *
 * 横幅（任务成功 / 任务失败）+ 公开汇总（成功牌/失败牌数量；个人出牌永不公开）。
 * 6 秒自动关闭，也可手动点"知道了"关闭。
 */

import type { AvalonQuestHistoryView } from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, shadows, spacing, textStyles } from '@/theme';

import { formatAvalonRoundLabel } from '../policy/avalonInteractionPolicy';

/** 结算面板自动关闭时长（与投票结算面板一致）。 */
const QUEST_RESULT_AUTO_DISMISS_MS = 6000;

/** 任务结算面板；挂载即开始 6 秒倒计时，到时或手动"知道了"都走 onClose。 */
export function AvalonQuestResultPanel({
  entry,
  onClose,
}: {
  readonly entry: AvalonQuestHistoryView;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), QUEST_RESULT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);
  const succeeded = entry.result === 'success';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-quest-result-panel"
        >
          <Text
            style={[styles.banner, succeeded ? styles.bannerSuccess : styles.bannerFail]}
            testID="avalon-quest-result-banner"
          >
            {formatAvalonRoundLabel(entry.round)} · {succeeded ? '任务成功' : '任务失败'}
          </Text>
          <Text style={styles.summary} testID="avalon-quest-result-counts">
            成功牌 {entry.successCount} · 失败牌 {entry.failCount}
          </Text>
          <Button
            variant="secondary"
            size="lg"
            onPress={onClose}
            testID="avalon-quest-result-close"
          >
            知道了
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '85%',
    gap: spacing.medium,
    padding: spacing.large,
    borderRadius: borderRadius.large,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  banner: {
    ...textStyles.titleBold,
    textAlign: 'center',
  },
  bannerSuccess: {
    color: colors.success,
  },
  bannerFail: {
    color: colors.error,
  },
  summary: {
    ...textStyles.body,
    color: colors.text,
    textAlign: 'center',
  },
});

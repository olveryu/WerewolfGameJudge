/**
 * 阿瓦隆湖仙查验结果弹窗：结果产生时向持有人自动弹出一次（按查验去重），
 * 手动关闭——结果不在公开历史中呈现，自动关可能让持有人错过。
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, shadows, spacing, textStyles } from '@/theme';

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';

/** 查验结果弹窗：只有查验持有人能看到（viewModel 已按持有人裁剪）。 */
export function AvalonLadyResultModal({
  targetName,
  faction,
  onClose,
}: {
  readonly targetName: string;
  readonly faction: 'good' | 'evil';
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-lady-result-modal"
        >
          <Text style={styles.title}>查验结果</Text>
          <Text style={styles.body} testID="avalon-lady-result-text">
            {targetName} 是{getAvalonCheckedFactionDisplayName(faction)}人。
          </Text>
          <Text style={styles.hint}>查验结果只有你能看到，可在讨论中透露、隐瞒或误导。</Text>
          <Button variant="primary" size="lg" onPress={onClose} testID="avalon-lady-result-close">
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
  title: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

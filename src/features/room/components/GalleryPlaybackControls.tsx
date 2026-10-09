/**
 * GalleryPlaybackControls - 同步回放控制条（房主控制全员进度，游戏无关）。
 *
 * 只吃展示状态与回调：不知道任何游戏的命令类型——命令组装（含「全部揭晓」的
 * 二次确认）留在各游戏侧，本组件只负责按钮形态与禁用逻辑。
 * 形态统一：翻页用共享 Button icon 形态（chevron）；播放/暂停为 secondary
 * 图标+文字；结尾页的 advance 切换为 primary 文字按钮（如「下一本」「结束揭晓」）。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/Button';
import { colors, componentSizes, spacing } from '@/theme';

interface GalleryPlaybackControlsProps {
  /** 当前是否正在自动播放（决定播放/暂停按钮的图标与文案）。 */
  readonly isPlaying: boolean;
  /** 是否显示播放/暂停按钮（无自动播放时长配置时隐藏）。 */
  readonly canTogglePlay: boolean;
  /** 是否已在第一项（决定 rewind 禁用）。 */
  readonly isFirst: boolean;
  /** 提交中：全部按钮禁用。 */
  readonly isSubmitting: boolean;
  /** advance 的形态：普通页为 icon，结尾页为 primary 文字按钮。 */
  readonly advanceForm: 'icon' | 'primary';
  /** advance 的文案与无障碍名（如「下一项」「下一本」「结束揭晓」）。 */
  readonly advanceLabel: string;
  /** rewind 的无障碍文案（如「上一项」「上一段」）。 */
  readonly rewindLabel: string;
  /** 播放按钮文案（如「播放」「继续回放」）。 */
  readonly playLabel: string;
  /** 暂停按钮文案（如「暂停」「暂停回放」）。 */
  readonly pauseLabel: string;
  /** 结束按钮文案（如「全部揭晓」）。 */
  readonly finishLabel: string;
  readonly onRewind: () => void;
  readonly onAdvance: () => void;
  readonly onTogglePlay: () => void;
  /** 「全部揭晓」：确认弹窗与命令提交由游戏侧在回调内处理。 */
  readonly onFinish: () => void;
  /** advance 按钮的 testID（可选，供 e2e 定位）。 */
  readonly advanceTestID?: string;
  /** 根容器附加样式（如停靠栏的边框/内边距），由游戏侧提供。 */
  readonly style?: StyleProp<ViewStyle>;
}

export const GalleryPlaybackControls: React.FC<GalleryPlaybackControlsProps> = ({
  isPlaying,
  canTogglePlay,
  isFirst,
  isSubmitting,
  advanceForm,
  advanceLabel,
  rewindLabel,
  playLabel,
  pauseLabel,
  finishLabel,
  onRewind,
  onAdvance,
  onTogglePlay,
  onFinish,
  advanceTestID,
  style,
}) => (
  <View style={[styles.row, style]}>
    <Button
      variant="icon"
      size="md"
      accessibilityLabel={rewindLabel}
      disabled={isFirst || isSubmitting}
      onPress={onRewind}
    >
      <Ionicons name="chevron-back" size={componentSizes.icon.md} color={colors.text} />
    </Button>
    {advanceForm === 'primary' ? (
      <Button
        variant="primary"
        size="md"
        accessibilityLabel={advanceLabel}
        disabled={isSubmitting}
        onPress={onAdvance}
        testID={advanceTestID}
      >
        {advanceLabel}
      </Button>
    ) : (
      <Button
        variant="icon"
        size="md"
        accessibilityLabel={advanceLabel}
        disabled={isSubmitting}
        onPress={onAdvance}
        testID={advanceTestID}
      >
        <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.text} />
      </Button>
    )}
    {canTogglePlay && (
      <Button
        variant="secondary"
        size="md"
        accessibilityLabel={isPlaying ? pauseLabel : playLabel}
        disabled={isSubmitting}
        onPress={onTogglePlay}
        icon={<Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.primary} />}
      >
        {isPlaying ? pauseLabel : playLabel}
      </Button>
    )}
    <Button variant="secondary" size="md" disabled={isSubmitting} onPress={onFinish}>
      {finishLabel}
    </Button>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
});

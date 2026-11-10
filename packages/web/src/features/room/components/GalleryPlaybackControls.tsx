/**
 * GalleryPlaybackControls - 同步回放控制条（房主控制全员进度，游戏无关）。
 *
 * 只吃展示状态与回调：不知道任何游戏的命令类型——命令组装（含「全部揭晓」的
 * 二次确认）留在各游戏侧，本组件只负责按钮形态与禁用逻辑。
 * 翻页为图标按钮（chevron）；播放/暂停为 secondary 图标+文字；结尾页的 advance
 * 切换为 primary 文字按钮（如「下一本」「结束揭晓」）。
 */

import './GalleryPlaybackControls.css';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconPause from '~icons/ion/pause';
import IconPlay from '~icons/ion/play';

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
  /** advance 按钮的 data-testid（缺省为通用的 galleryAdvanceButton）。 */
  readonly advanceTestId?: string;
}

/** Renders rewind, advance, play/pause and finish controls for a host-driven gallery. */
export function GalleryPlaybackControls({
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
  advanceTestId = TESTIDS.galleryAdvanceButton,
}: GalleryPlaybackControlsProps) {
  return (
    <div className="gallery-playback-controls">
      <IconButton
        label={rewindLabel}
        icon={<IconChevronBack aria-hidden />}
        disabled={isFirst || isSubmitting}
        onClick={onRewind}
        data-testid={TESTIDS.galleryRewindButton}
      />
      {advanceForm === 'primary' ? (
        <Button
          variant="primary"
          size="md"
          disabled={isSubmitting}
          onClick={onAdvance}
          data-testid={advanceTestId}
        >
          {advanceLabel}
        </Button>
      ) : (
        <IconButton
          label={advanceLabel}
          icon={<IconChevronForward aria-hidden />}
          disabled={isSubmitting}
          onClick={onAdvance}
          data-testid={advanceTestId}
        />
      )}
      {canTogglePlay && (
        <Button
          variant="secondary"
          size="md"
          disabled={isSubmitting}
          onClick={onTogglePlay}
          data-testid={TESTIDS.galleryTogglePlayButton}
        >
          {isPlaying ? (
            <IconPause aria-hidden className="gallery-playback-toggle-icon" />
          ) : (
            <IconPlay aria-hidden className="gallery-playback-toggle-icon" />
          )}
          {isPlaying ? pauseLabel : playLabel}
        </Button>
      )}
      <Button
        variant="secondary"
        size="md"
        disabled={isSubmitting}
        onClick={onFinish}
        data-testid={TESTIDS.galleryFinishButton}
      >
        {finishLabel}
      </Button>
    </div>
  );
}

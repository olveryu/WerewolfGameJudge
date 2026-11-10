import './DrawButton.css';

import IconSparkles from '~icons/ion/sparkles';
import IconStar from '~icons/ion/star';

interface DrawButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
  golden?: boolean;
  /** Draws a multi-pull will make when fewer than 10 tickets remain. */
  multiPullCount?: number;
  reducedMotion: boolean;
  /** False while the app is in the background: the shimmer stops. */
  isAnimationActive: boolean;
}

/** A draw button: gradient fill, a sweeping shimmer while enabled, and the ticket shortfall note. */
export function DrawButton({
  label,
  disabled,
  onPress,
  golden = false,
  multiPullCount,
  reducedMotion,
  isAnimationActive,
}: DrawButtonProps) {
  const showShimmer = isAnimationActive && !reducedMotion && !disabled;
  const Icon = golden ? IconStar : IconSparkles;
  return (
    <button
      type="button"
      className="draw-button"
      data-golden={golden}
      disabled={disabled}
      aria-label={label}
      onClick={onPress}
    >
      {showShimmer && <span className="draw-button-shimmer" data-testid="draw-button-shimmer" />}
      <span className="draw-button-highlight" />
      <span className="draw-button-content">
        <Icon className="draw-button-icon" aria-hidden />
        <span className="draw-button-label">{label}</span>
      </span>
      {disabled ? (
        <span className="draw-button-note">券不足</span>
      ) : (
        multiPullCount !== undefined &&
        multiPullCount < 10 && (
          <span className="draw-button-note" data-partial="true">
            仅剩 {multiPullCount} 抽
          </span>
        )
      )}
    </button>
  );
}

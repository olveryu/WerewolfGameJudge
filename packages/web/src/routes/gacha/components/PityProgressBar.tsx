import './PityProgressBar.css';

interface PityProgressBarProps {
  pity: number;
  threshold: number;
  golden?: boolean;
  reducedMotion: boolean;
  /** False while the app is in the background: the near-pity pulse stops. */
  isAnimationActive: boolean;
}

/** Progress toward the pity guarantee; within 80% it brightens, gains a glow tip, and pulses. */
export function PityProgressBar({
  pity,
  threshold,
  golden = false,
  reducedMotion,
  isAnimationActive,
}: PityProgressBarProps) {
  const ratio = pity / threshold;
  const isNear = ratio >= 0.8;
  const fillPercent = Math.min(ratio * 100, 100);
  const pulse = isAnimationActive && isNear && !reducedMotion;
  return (
    <div className="pity-bar" data-golden={golden} data-near={isNear}>
      <div
        className="pity-bar-track"
        role="progressbar"
        aria-label={golden ? '黄金保底进度' : '普通保底进度'}
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={pity}
      >
        <span
          className="pity-bar-fill"
          data-testid="pity-bar-fill"
          data-pulse={pulse}
          style={{ width: `${fillPercent}%` }}
        >
          {isNear && <span className="pity-bar-tip" />}
        </span>
      </div>
      <span className="pity-bar-text">
        {pity}/{threshold}
      </span>
    </div>
  );
}

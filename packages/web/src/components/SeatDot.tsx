/**
 * Circular seat-number marker shared by the record and review surfaces (sheriff election panel,
 * pending-seat rows). `seat` is 0-based; the dot renders `seat + 1`. `withdrawn` dims the dot and
 * strikes the number through. The accessible name is `N号`, extended with `，<stateLabel>` when the
 * caller passes a state word (each surface's own vocabulary, e.g. 已退水).
 */
import './SeatDot.css';

import IconFlag from '~icons/ion/flag';

interface SeatDotProps {
  /** 0-based seat index; the dot renders seat + 1. */
  readonly seat: number;
  /** md = avatar xs (default), sm = badge md. Ignored when emphasis is set. */
  readonly size?: 'md' | 'sm';
  /**
   * Enlarged avatar-sm variants: `leader` (primary ring and tint, flag marker) and `filled`
   * (primary fill, inverse text).
   */
  readonly emphasis?: 'none' | 'leader' | 'filled';
  /** Dims the dot and strikes the number through (withdrawn candidate). */
  readonly withdrawn?: boolean;
  /** Caller-owned state word appended to the accessible name. */
  readonly stateLabel?: string;
  readonly testId?: string;
}

export function SeatDot({
  seat,
  size = 'md',
  emphasis = 'none',
  withdrawn = false,
  stateLabel,
  testId,
}: SeatDotProps) {
  return (
    <span
      className="seat-dot"
      data-size={size}
      data-emphasis={emphasis}
      data-withdrawn={withdrawn}
      role="img"
      aria-label={stateLabel === undefined ? `${seat + 1}号` : `${seat + 1}号，${stateLabel}`}
      data-testid={testId}
    >
      <span aria-hidden>{seat + 1}</span>
      {emphasis === 'leader' && (
        <span className="seat-dot-leader-marker" aria-hidden>
          <IconFlag />
        </span>
      )}
    </span>
  );
}

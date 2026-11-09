import './roomControls.css';

import { IconButton } from '@/components/IconButton';
import IconChevronBack from '~icons/ion/chevron-back';
import IconChevronForward from '~icons/ion/chevron-forward';

/**
 * Gallery pager: previous / next icon buttons around an "N / M" position. Pure display
 * state and callbacks; the game owns which page is shown.
 */
export function GalleryPagerControls({
  current,
  total,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  /** Current page, zero-based. */
  readonly current: number;
  readonly total: number;
  readonly prevLabel: string;
  readonly nextLabel: string;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}) {
  return (
    <div className="gallery-pager">
      <IconButton
        label={prevLabel}
        icon={<IconChevronBack aria-hidden />}
        disabled={current <= 0}
        onClick={onPrev}
      />
      <span className="gallery-pager-position">
        {current + 1} / {total}
      </span>
      <IconButton
        label={nextLabel}
        icon={<IconChevronForward aria-hidden />}
        disabled={current >= total - 1}
        onClick={onNext}
      />
    </div>
  );
}

/** The blocker of a disabled room action, printed directly under its button. */
export function DisabledReasonCaption({ reason }: { readonly reason: string }) {
  return <p className="disabled-reason-caption">{reason}</p>;
}

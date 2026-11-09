/**
 * Gallery album heading: eyebrow, title, description and the gallery timer.
 *
 * The props and the countdown semantics (unlimited, switching, final seconds) are
 * game-agnostic, so every gallery shares this one heading.
 */

import './GalleryAlbumHeading.css';

import { formatCountdownSeconds } from '@/features/room/model/formatCountdown';
import IconSyncOutline from '~icons/ion/sync-outline';
import IconTimeOutline from '~icons/ion/time-outline';

const URGENT_SECONDS = 10;

interface GalleryAlbumHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  /** Null means the gallery has no time limit. */
  readonly remainingSeconds: number | null;
}

/** Renders the gallery's heading copy beside its live countdown pill. */
export function GalleryAlbumHeading({
  eyebrow,
  title,
  description,
  remainingSeconds,
}: GalleryAlbumHeadingProps) {
  const isUrgent = remainingSeconds !== null && remainingSeconds <= URGENT_SECONDS;
  return (
    <div className="gallery-album-heading">
      <div className="gallery-album-heading-copy">
        <p className="gallery-album-heading-eyebrow">{eyebrow}</p>
        <h2 className="gallery-album-heading-title">{title}</h2>
        <p className="gallery-album-heading-description">{description}</p>
      </div>
      <div
        className="gallery-album-heading-timer"
        data-urgent={isUrgent || undefined}
        role="timer"
        aria-live="polite"
        aria-label={remainingSeconds === null ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`}
      >
        {remainingSeconds === 0 ? <IconSyncOutline aria-hidden /> : <IconTimeOutline aria-hidden />}
        <span aria-hidden>
          {remainingSeconds === null
            ? '不限时'
            : remainingSeconds === 0
              ? '切换中'
              : formatCountdownSeconds(remainingSeconds)}
        </span>
      </div>
    </div>
  );
}

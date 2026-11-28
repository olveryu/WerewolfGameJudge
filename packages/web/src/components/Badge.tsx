import './Badge.css';

import type { ReactNode } from 'react';

/** Accent of a badge: a faction, or `muted` for a group outside the factions. */
export type BadgeTone = 'wolf' | 'god' | 'villager' | 'third' | 'muted';

/**
 * A small outlined label in its tone's color (role names, counts, states). A button when it has
 * an action; `showChevron` then marks it as opening something.
 */
export function Badge({
  tone,
  size = 'sm',
  onPress,
  showChevron = false,
  children,
}: {
  readonly tone: BadgeTone;
  /** sm = caption font (board lists), md = secondary font (room). */
  readonly size?: 'sm' | 'md';
  /** When provided, the badge is a button. */
  readonly onPress?: () => void;
  readonly showChevron?: boolean;
  readonly children: ReactNode;
}) {
  const chevron = showChevron ? (
    <span className="badge-chevron" aria-hidden="true">
      ›
    </span>
  ) : null;
  if (onPress === undefined) {
    return (
      <span className="badge" data-size={size} data-tone={tone}>
        {children}
        {chevron}
      </span>
    );
  }
  return (
    <button type="button" className="badge" data-size={size} data-tone={tone} onClick={onPress}>
      {children}
      {chevron}
    </button>
  );
}

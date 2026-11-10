/** Public game information above a room's seats, and the text-labelled guide action. */
import './RoomGameSummary.css';

import type { ReactNode } from 'react';

import { IonIcon, type IoniconName } from '@/components/icons/IonIcon';
import { TESTIDS } from '@/testids';
import IconBookOutline from '~icons/ion/book-outline';
import IconChevronForward from '~icons/ion/chevron-forward';

export function RoomGameSummary({
  icon,
  title,
  subtitle,
  headerRight,
  children,
  testId,
}: {
  readonly icon: IoniconName;
  readonly title: string;
  /** Optional configuration line; omitted when the title already carries the configuration. */
  readonly subtitle?: string;
  readonly headerRight?: ReactNode;
  readonly children?: ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className="room-game-summary" data-testid={testId}>
      <div className="room-game-summary-row">
        <div className="room-game-summary-identity">
          <span className="room-game-summary-icon" aria-hidden>
            <IonIcon name={icon} />
          </span>
          <div className="room-game-summary-text">
            <h2 className="room-game-summary-title" data-testid={TESTIDS.roomGameSummaryTitle}>
              {title}
            </h2>
            {subtitle !== undefined && <p className="room-game-summary-subtitle">{subtitle}</p>}
          </div>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

/** Opens the game guide; reports the navigation intent only. */
export function RoomGuideButton({
  onPress,
  label,
  testId,
}: {
  readonly onPress: () => void;
  /** Accessible name, e.g. 「查看Demo玩法」. */
  readonly label: string;
  readonly testId?: string;
}) {
  return (
    <button
      type="button"
      className="room-guide-button"
      onClick={onPress}
      aria-label={label}
      data-testid={testId}
    >
      <IconBookOutline className="room-guide-button-icon" aria-hidden />
      玩法
      <IconChevronForward className="room-guide-button-chevron" aria-hidden />
    </button>
  );
}

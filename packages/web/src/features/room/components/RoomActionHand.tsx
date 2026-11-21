import './RoomActionHand.css';

import {
  Children,
  type CSSProperties,
  isValidElement,
  type KeyboardEventHandler,
  type ReactNode,
} from 'react';

type HandStyle = CSSProperties & {
  '--hand-card-count': number;
};

type CardStyle = CSSProperties & {
  '--hand-card-angle': string;
  '--hand-card-drop': string;
  '--hand-card-order': number;
};

/** Arranges independent action targets over the overlapping card faces. */
export function RoomActionHand({
  children,
  label,
  className,
  onKeyDown,
  testId,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly className?: string;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  readonly testId?: string;
}) {
  const cards = Children.toArray(children);
  const style: HandStyle = { '--hand-card-count': cards.length };
  return (
    <div
      className={['room-action-hand', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      data-testid={testId}
      onKeyDown={onKeyDown}
      style={style}
    >
      {cards.map((card, index) => {
        const distance = index - (cards.length - 1) / 2;
        const cardStyle: CardStyle = {
          '--hand-card-angle': `${distance * 1.5}deg`,
          '--hand-card-drop': `${Math.abs(distance) * 4}px`,
          '--hand-card-order': index + 1,
        };
        return (
          <div
            className="room-action-card-cell"
            style={cardStyle}
            key={isValidElement(card) ? card.key : index}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}

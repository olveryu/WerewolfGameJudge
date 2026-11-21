import './RoomActionHand.css';

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import type { RoomHand } from '@/features/room/model/RoomHand';
import { TESTIDS } from '@/testids';

import { RoomHandCardButton } from './RoomHandCardButton';

type HandStyle = CSSProperties & { '--hand-card-count': number };
type CardStyle = CSSProperties & {
  '--hand-card-angle': string;
  '--hand-card-drop': string;
  '--hand-card-order': number;
};

/** Renders the projected hand and owns blocked-action feedback and focus restoration. */
export function RoomActionHand({
  hand,
  focusCardId,
  onFocusRestored,
  onBack,
  testId,
}: {
  readonly hand: RoomHand;
  readonly focusCardId: string | null;
  readonly onFocusRestored: () => void;
  readonly onBack: () => void;
  readonly testId?: string;
}) {
  const [reason, setReason] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const focusCard = useCallback(
    (cardId: string) => (button: HTMLButtonElement | null) => {
      if (button === null) return;
      const isNavigationTarget = cardId === focusCardId;
      if (!isNavigationTarget) return;
      button.focus({ preventScroll: true });
      onFocusRestored();
    },
    [focusCardId, onFocusRestored],
  );
  const style: HandStyle = { '--hand-card-count': hand.cards.length };
  return (
    <div
      className="room-action-hand"
      role="group"
      aria-label={hand.label}
      data-testid={testId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || hand.face.kind === 'main') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }}
      style={style}
    >
      <div
        className="room-hand-reason"
        role="status"
        data-testid={TESTIDS.roomHandUnavailableReason}
      >
        {reason}
      </div>
      {hand.cards.map((card, index) => {
        const distance = index - (hand.cards.length - 1) / 2;
        const cardStyle: CardStyle = {
          '--hand-card-angle': `${distance * 1.5}deg`,
          '--hand-card-drop': `${Math.abs(distance) * 4}px`,
          '--hand-card-order': index + 1,
        };
        return (
          <div className="room-action-card-cell" style={cardStyle} key={card.id}>
            <RoomHandCardButton
              ref={focusCard(card.id)}
              card={card}
              onBlocked={(message) => {
                if (timer.current !== null) clearTimeout(timer.current);
                setReason(message);
                timer.current = setTimeout(() => setReason(''), 5000);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

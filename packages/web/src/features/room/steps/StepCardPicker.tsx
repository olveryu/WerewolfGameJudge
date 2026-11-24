import './StepCardPicker.css';

import type { CardOption } from '@game-judge/game-engine/platform/steps';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { showDismissAlert } from '@/utils/alertPresets';

/**
 * Displays generic step card options without depending on a particular game or role.
 */
export function StepCardPicker({
  title,
  hint,
  cards,
  onPick,
  onClose,
  onAlertShown,
}: {
  readonly title: string;
  readonly hint: string | null;
  readonly cards: readonly CardOption[];
  readonly onPick: (cardIndex: number) => void;
  readonly onClose: () => void;
  readonly onAlertShown: (generation: number | null) => void;
}) {
  return (
    <BottomSheet title={title} onClose={onClose} testId={TESTIDS.stepCardPicker}>
      <div className="step-card-picker">
        <h2 className="step-card-picker-title">{title}</h2>
        {hint !== null && <p className="step-card-picker-hint">{hint}</p>}
        <div className="step-card-picker-options" role="group" aria-label={title}>
          {cards.map((card) => {
            const reasonId = `step-card-option-reason-${card.index}`;
            const isUnavailable = card.unavailableReason !== null;
            return (
              <button
                key={card.index}
                type="button"
                className="step-card-picker-option"
                aria-disabled={isUnavailable}
                aria-describedby={isUnavailable ? reasonId : undefined}
                data-testid={TESTIDS.stepCardOption(card.index)}
                onClick={() => {
                  if (card.unavailableReason !== null) {
                    showDismissAlert('暂不可选', card.unavailableReason, undefined, onAlertShown);
                    return;
                  }
                  onPick(card.index);
                }}
              >
                <span className="step-card-picker-label">{card.label}</span>
                {card.unavailableReason !== null && (
                  <span id={reasonId} className="step-card-picker-reason">
                    {card.unavailableReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
      </div>
    </BottomSheet>
  );
}

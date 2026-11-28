import './Stepper.css';

import { IconButton } from '@/components/IconButton';
import IconAdd from '~icons/ion/add';
import IconRemove from '~icons/ion/remove';

/**
 * The count of a stepper: a numeric text field the user may also type into, or a read-only
 * number changed only by the −/+ buttons.
 */
export type StepperEntry =
  | {
      readonly kind: 'text';
      readonly value: string;
      readonly onChangeText: (value: string) => void;
    }
  | { readonly kind: 'readonly'; readonly value: number };

/** A labelled count with −/+ buttons; callers own the value, the bounds and validation. */
export function Stepper({
  label,
  entry,
  testId,
  decrementTestId,
  incrementTestId,
  onDecrement,
  onIncrement,
  isDecrementDisabled,
  isIncrementDisabled,
  decrementLabel = '减少人数',
  incrementLabel = '增加人数',
}: {
  readonly label: string;
  readonly entry: StepperEntry;
  readonly testId: string;
  readonly decrementTestId: string;
  readonly incrementTestId: string;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
  readonly isDecrementDisabled: boolean;
  readonly isIncrementDisabled: boolean;
  /** Accessible names of the step buttons; player-count fields keep the defaults. */
  readonly decrementLabel?: string;
  readonly incrementLabel?: string;
}) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <span className="stepper">
        <IconButton
          label={decrementLabel}
          icon={<IconRemove aria-hidden />}
          disabled={isDecrementDisabled}
          onClick={onDecrement}
          data-testid={decrementTestId}
        />
        {entry.kind === 'text' ? (
          <input
            className="stepper-count"
            inputMode="numeric"
            value={entry.value}
            aria-label={label}
            data-testid={testId}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => entry.onChangeText(event.currentTarget.value)}
          />
        ) : (
          <output className="stepper-count" aria-label={label} data-testid={testId}>
            {entry.value}
          </output>
        )}
        <IconButton
          label={incrementLabel}
          icon={<IconAdd aria-hidden />}
          disabled={isIncrementDisabled}
          onClick={onIncrement}
          data-testid={incrementTestId}
        />
      </span>
    </div>
  );
}

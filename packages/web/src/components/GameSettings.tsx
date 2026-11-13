/** Shared game-settings controls; callers own the displayed values, editing and validation. */
import './GameSettings.css';

import { type KeyboardEvent, useId } from 'react';

import { IconButton } from '@/components/IconButton';
import { Switch } from '@/components/Switch';
import IconAdd from '~icons/ion/add';
import IconRemove from '~icons/ion/remove';

/** A labelled count with −/+ buttons and a numeric text field. */
export function GameSettingsStepper({
  label,
  value,
  onChangeText,
  testId,
  decrementTestId,
  incrementTestId,
  issueId,
  isInvalid = false,
  onDecrement,
  onIncrement,
  isDecrementDisabled,
  isIncrementDisabled,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly testId: string;
  readonly decrementTestId: string;
  readonly incrementTestId: string;
  readonly issueId?: string;
  readonly isInvalid?: boolean;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
  readonly isDecrementDisabled: boolean;
  readonly isIncrementDisabled: boolean;
}) {
  const actionLabel = label === '玩家人数' ? '人数' : label;
  return (
    <div className="game-settings-row">
      <span className="game-settings-label">{label}</span>
      <span className="game-settings-stepper">
        <IconButton
          label={`减少${actionLabel}`}
          icon={<IconRemove aria-hidden />}
          disabled={isDecrementDisabled}
          onClick={onDecrement}
          data-testid={decrementTestId}
        />
        <input
          className="game-settings-count"
          inputMode="numeric"
          value={value}
          aria-label={label}
          aria-describedby={issueId}
          aria-invalid={isInvalid || undefined}
          data-testid={testId}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChangeText(event.currentTarget.value)}
        />
        <IconButton
          label={`增加${actionLabel}`}
          icon={<IconAdd aria-hidden />}
          disabled={isIncrementDisabled}
          onClick={onIncrement}
          data-testid={incrementTestId}
        />
      </span>
    </div>
  );
}

/** A labelled boolean row; callers render any hint below it inside their own section. */
export function GameSettingsSwitch({
  label,
  value,
  onValueChange,
  tone,
  testId,
  issueId,
  isInvalid = false,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly tone: 'primary' | 'warning';
  readonly testId: string;
  readonly issueId?: string;
  readonly isInvalid?: boolean;
}) {
  return (
    <label className="game-settings-row">
      <span className="game-settings-label">{label}</span>
      <Switch
        checked={value}
        tone={tone}
        data-testid={testId}
        aria-describedby={issueId}
        aria-invalid={isInvalid || undefined}
        onChange={(event) => onValueChange(event.currentTarget.checked)}
      />
    </label>
  );
}

/**
 * A titled radio-pill group (WAI-ARIA radio group: arrow keys move the selection, only the
 * checked pill is in the tab order). Options carry caller-owned values and labels; each is
 * announced by its own label because the group carries the title.
 */
export function GameSettingsChoice<TValue extends string | number | null>({
  title,
  hint,
  options,
  value,
  onChange,
  optionTestId,
  issueId,
  isInvalid = false,
}: {
  readonly title: string;
  readonly hint: string | undefined;
  readonly options: readonly { readonly value: TValue; readonly label: string }[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly optionTestId: (value: TValue) => string;
  readonly issueId?: string;
  readonly isInvalid?: boolean;
}) {
  const titleId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (focusIndex + step + options.length) % options.length;
    const next = options[nextIndex];
    if (next === undefined) return;
    onChange(next.value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[nextIndex]?.focus();
  };
  return (
    <div className="game-settings-choice">
      <span id={titleId} className="game-settings-label">
        {title}
      </span>
      {hint !== undefined && <p className="game-settings-hint">{hint}</p>}
      <div
        className="game-settings-options"
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={issueId}
        aria-invalid={isInvalid || undefined}
        onKeyDown={moveSelection}
      >
        {options.map((option, index) => {
          const isChecked = option.value === value;
          return (
            <button
              key={option.value === null ? 'null' : String(option.value)}
              type="button"
              role="radio"
              aria-checked={isChecked}
              tabIndex={index === focusIndex ? 0 : -1}
              className="game-settings-option"
              data-testid={optionTestId(option.value)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Label for one second-count option; `null` means no time limit. */
export function formatDurationOption(value: number | null, nullLabel = '不限时'): string {
  return value === null ? nullLabel : `${value} 秒`;
}

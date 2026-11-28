/** Shared game-settings controls; callers own the displayed values, editing and validation. */
import './GameSettings.css';

import { type KeyboardEvent, type ReactNode, useId } from 'react';

import { Switch } from '@/components/Switch';

/** A settings block (a field and its hint/issue lines), divided from the next by a rule. */
export function GameSettingsSection({ children }: { readonly children: ReactNode }) {
  return <div className="game-settings-section">{children}</div>;
}

/** The title of a settings block that has no control of its own. */
export function GameSettingsLabel({ children }: { readonly children: ReactNode }) {
  return <span className="game-settings-label">{children}</span>;
}

/** A secondary explanation line under a setting. */
export function GameSettingsHint({ children }: { readonly children: ReactNode }) {
  return <p className="game-settings-hint">{children}</p>;
}

/** A validation message of a setting, announced when it appears. */
export function GameSettingsIssue({
  testId,
  children,
}: {
  readonly testId: string;
  readonly children: ReactNode;
}) {
  return (
    <p className="game-settings-issue" aria-live="polite" data-testid={testId}>
      {children}
    </p>
  );
}

/** The centered summary line above a settings page's submit button (e.g. 「已选 12 人」). */
export function GameSettingsSummary({ children }: { readonly children: ReactNode }) {
  return <p className="game-settings-summary">{children}</p>;
}

/** A labelled boolean row; callers render any hint below it inside their own section. */
export function GameSettingsSwitch({
  label,
  value,
  onValueChange,
  tone,
  testId,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly tone: 'primary' | 'warning';
  readonly testId: string;
}) {
  return (
    <label className="game-settings-row">
      <span className="game-settings-label">{label}</span>
      <Switch
        checked={value}
        tone={tone}
        data-testid={testId}
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
}: {
  readonly title: string;
  readonly hint: string | undefined;
  readonly options: readonly { readonly value: TValue; readonly label: string }[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly optionTestId: (value: TValue) => string;
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

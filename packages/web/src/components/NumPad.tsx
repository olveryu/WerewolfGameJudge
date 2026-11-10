import './NumPad.css';

import { TESTIDS } from '@/testids';

interface NumPadProps {
  value: string;
  onValueChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'del'],
] as const;

type NumPadKey = (typeof ROWS)[number][number];

const SPECIAL_LABELS: Partial<Record<NumPadKey, { text: string; label: string }>> = {
  clear: { text: 'C', label: '清除' },
  del: { text: '⌫', label: '退格' },
};

/** Numeric keypad for room codes; digits append up to `maxLength`, C clears, ⌫ deletes. */
export function NumPad({ value, onValueChange, maxLength, disabled = false }: NumPadProps) {
  const press = (key: NumPadKey) => {
    if (key === 'clear') onValueChange('');
    else if (key === 'del') onValueChange(value.slice(0, -1));
    else if (value.length < maxLength) onValueChange(value + key);
  };

  return (
    <div className="numpad">
      {ROWS.flat().map((key) => {
        const special = SPECIAL_LABELS[key];
        return (
          <button
            key={key}
            type="button"
            className="numpad-key"
            data-special={special !== undefined}
            disabled={disabled}
            aria-label={special?.label ?? `数字${key}`}
            data-testid={TESTIDS.numpadKey(key)}
            onClick={() => press(key)}
          >
            {special?.text ?? key}
          </button>
        );
      })}
    </div>
  );
}

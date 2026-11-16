import './FactionChip.css';

type ChipSize = 'sm' | 'md';

interface FactionChipProps {
  /** Display text (role name, optionally with ×count). */
  readonly label: string;
  /** Faction color as a CSS value (e.g. `var(--color-wolf)`). */
  readonly color: string;
  /** sm = caption font (board lists), md = secondary font (room). */
  readonly size?: ChipSize;
  /** When provided, the chip is a button. */
  readonly onPress?: () => void;
  /** When true, render a › affordance after the label (tappable chip). */
  readonly showChevron?: boolean;
}

/** Faction-colored rounded chip with a role name; a button when it has an action. */
export function FactionChip({
  label,
  color,
  size = 'sm',
  onPress,
  showChevron = false,
}: FactionChipProps) {
  const style = { '--chip-color': color };
  const chevron = showChevron ? (
    <span className="faction-chip-chevron" aria-hidden="true">
      ›
    </span>
  ) : null;
  if (onPress === undefined) {
    return (
      <span className="faction-chip" data-size={size} style={style}>
        {label}
        {chevron}
      </span>
    );
  }
  return (
    <button type="button" className="faction-chip" data-size={size} style={style} onClick={onPress}>
      {label}
      {chevron}
    </button>
  );
}

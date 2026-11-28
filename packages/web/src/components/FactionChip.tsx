import { Badge, type BadgeTone } from './Badge';

/** A role name (optionally with ×count) as a badge in its group's tone; a button when it has an action. */
export function FactionChip({
  label,
  tone,
  size = 'sm',
  onPress,
  showChevron = false,
}: {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly size?: 'sm' | 'md';
  readonly onPress?: () => void;
  readonly showChevron?: boolean;
}) {
  return (
    <Badge tone={tone} size={size} onPress={onPress} showChevron={showChevron}>
      {label}
    </Badge>
  );
}

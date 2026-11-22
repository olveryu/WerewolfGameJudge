/**
 * RoleChip — role selection chip. Selected chips take the section's faction color; chips
 * with variant alternatives wear the swap icon in the top-left corner. Tapping the chip
 * toggles the role on/off the board; long-pressing it opens its role info card.
 */
import { useEffect, useRef } from 'react';

import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';
import IconSwapHorizontalOutline from '~icons/ion/swap-horizontal-outline';

/** Hold duration that turns a press into a long-press opening the role info card. */
const LONG_PRESS_MS = 500;

interface RoleChipProps {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: (id: string) => void;
  /** Faction color of the selected state. */
  readonly faction: FactionColorKey;
  /** Whether this chip has variant alternatives (shows the swap icon). */
  readonly hasVariants?: boolean;
  /** Long-press handler for showing the role info card. */
  readonly onInfoPress?: (id: string) => void;
}

/**
 * Role chip component.
 *
 * A tap toggles the role; a long-press opens the role info card. The press that opens the
 * card must not also toggle the role, so the click that follows a long-press is swallowed.
 * The swap icon is a decorative indicator (pointer-events: none), so it never steals taps
 * from the body. A press that turns into a scroll (pointercancel) opens nothing.
 */
export function RoleChip({
  id,
  label,
  selected,
  onToggle,
  faction,
  hasVariants = false,
  onInfoPress,
}: RoleChipProps) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  return (
    <span className="config-role-chip" data-faction={faction} data-selected={selected}>
      <button
        type="button"
        className="config-role-chip-body"
        data-testid={TESTIDS.configRoleChip(id)}
        aria-label={selected ? `移出${label}` : `加入${label}`}
        aria-pressed={selected}
        onPointerDown={(event) => {
          if (event.button !== undefined && event.button !== 0) return;
          longPressedRef.current = false;
          clearLongPressTimer();
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            longPressedRef.current = true;
            if (onInfoPress !== undefined) onInfoPress(id);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onClick={() => {
          if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
          }
          onToggle(id);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {label}
      </button>
      {hasVariants && (
        <span className="config-role-chip-variant-mark" aria-hidden="true">
          <IconSwapHorizontalOutline aria-hidden />
        </span>
      )}
    </span>
  );
}

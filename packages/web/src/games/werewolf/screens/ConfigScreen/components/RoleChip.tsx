/**
 * RoleChip — role selection tile (name only). Tapping the tile toggles the role on/off the
 * board; long-pressing it (~500ms) opens the role info card. The tile wears no badges: the
 * selected state is the faction-colored border, the tinted fill, and the faction-colored
 * name. Tiles with variant alternatives wear the swap mark in the top-left corner.
 */
import { useEffect, useRef } from 'react';

import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

/** Hold duration that turns a press into a long-press (opens the role info card). */
const LONG_PRESS_MS = 500;

interface RoleChipProps {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: (id: string) => void;
  /** Faction color of the selected state. */
  readonly faction: FactionColorKey;
  /** Whether this tile has variant alternatives (shows the swap mark). */
  readonly hasVariants?: boolean;
  /** Long-press handler for showing the role info card. */
  readonly onInfoPress?: (id: string) => void;
}

/**
 * Role tile.
 *
 * Tap toggles, long-press opens the info card, and the click that follows a long-press is
 * swallowed so the tile does not toggle right after the card opens. The timer is cancelled
 * on release, slide-off, or interruption, and on unmount.
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

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const clearLongPressTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <span className="config-role-chip" data-faction={faction} data-selected={selected}>
      <button
        type="button"
        className="config-role-chip-body"
        data-testid={TESTIDS.configRoleChip(id)}
        aria-pressed={selected}
        onPointerDown={() => {
          if (onInfoPress === undefined) return;
          longPressedRef.current = false;
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            longPressedRef.current = true;
            onInfoPress(id);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
          }
          onToggle(id);
        }}
      >
        {label}
      </button>
      {hasVariants && (
        <span className="config-role-chip-variant-mark" aria-hidden="true">
          ⇄
        </span>
      )}
    </span>
  );
}

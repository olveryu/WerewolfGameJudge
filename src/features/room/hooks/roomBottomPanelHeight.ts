/**
 * Height of the focused room's bottom action panel, published for app-level floating overlays
 * (they render outside the room tree) so they stay clear of the panel's controls.
 * Null while no focused room shows the panel.
 */
import { useSyncExternalStore } from 'react';

let panelHeight: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPanelHeight(): number | null {
  return panelHeight;
}

/** Records the focused room's bottom panel height; null when it is hidden or unfocused. */
export function publishRoomBottomPanelHeight(height: number | null): void {
  if (height === panelHeight) return;
  panelHeight = height;
  for (const listener of listeners) listener();
}

/** Returns the focused room's bottom panel height, or null when no panel is on screen. */
export function useRoomBottomPanelHeight(): number | null {
  return useSyncExternalStore(subscribe, getPanelHeight, getPanelHeight);
}

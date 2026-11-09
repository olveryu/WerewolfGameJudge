/**
 * Global alert queue for the app's single alert dialog (`AlertHost`).
 *
 * An external store: `showAlert` publishes the current alert and `AlertHost` renders it through
 * `useSyncExternalStore`. Every call bumps a generation so a button callback can tell whether its
 * alert was replaced while it ran.
 */

export interface AlertButton {
  text: string;
  onPress?: (inputValue?: string) => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}

/** Optional text input inside an alert. */
export interface AlertInputConfig {
  placeholder?: string;
  defaultValue?: string;
}

export interface AlertConfig {
  /** Identity of this alert; a replacement alert carries a new generation. */
  generation: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: AlertInputConfig;
}

let current: AlertConfig | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: AlertConfig | null): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Store contract for `useSyncExternalStore`. */
export const alertStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): AlertConfig | null => current,
};

/** Closes the alert with `expectedGeneration` unless a newer alert has replaced it. */
export function dismissAlert(expectedGeneration: number): void {
  if (expectedGeneration !== generation) return;
  generation += 1;
  publish(null);
}

/** Shows an alert; defaults to a single "确定" button. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  generation += 1;
  publish({ generation, title, message, buttons: buttons ?? [{ text: '确定' }] });
}

/** Shows a prompt with a text input; `onConfirm` receives the trimmed value. */
export function showPrompt(
  title: string,
  options: { placeholder?: string; defaultValue?: string; onConfirm: (value: string) => void },
): void {
  const { placeholder, defaultValue = '', onConfirm } = options;
  generation += 1;
  publish({
    generation,
    title,
    buttons: [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: (inputValue) => onConfirm(inputValue ?? defaultValue) },
    ],
    input: { placeholder, defaultValue },
  });
}

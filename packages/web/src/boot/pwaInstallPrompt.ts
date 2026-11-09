/**
 * Captures the Chromium `beforeinstallprompt` event at boot so the Home install entry can replay
 * it later. iOS never fires the event; the install entry shows a manual guide there instead.
 */

/** Chromium's deferred install prompt (not in the DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function publish(prompt: BeforeInstallPromptEvent | null): void {
  deferredPrompt = prompt;
  for (const listener of listeners) listener();
}

/** Starts listening for the install prompt; call once before the first render. */
export function capturePwaInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    publish(event);
  });
}

/** The captured install prompt, or `null` when the browser has not offered one. */
export function getPwaInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribePwaInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drops the prompt after the user accepted it; a prompt can be shown only once. */
export function clearPwaInstallPrompt(): void {
  publish(null);
}

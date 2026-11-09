/**
 * Login requests for the app's single `LoginDialog`. Callers await `requestLogin`; the dialog
 * resolves it with how the request ended.
 */

/** Where the dialog opens and how the email form behaves. */
export interface LoginRequest {
  title: string;
  subtitle?: string;
  /** Opens straight into the email form instead of the method list. */
  startWith?: 'options' | 'emailSignIn' | 'emailSignUp';
  /** Email form title override (e.g. 绑定邮箱). */
  formTitle?: string;
  /** Sign the current account out before email sign-in (switch account). */
  signOutFirst?: boolean;
  /** Toast 登录成功 after email sign-in. */
  showSuccessOnLogin?: boolean;
  hideDisplayName?: boolean;
  /** Offer the sign-in ↔ sign-up toggle (default true). */
  showToggleMode?: boolean;
}

export type LoginOutcome = 'signedIn' | 'signedUp' | 'cancelled';

interface PendingLogin {
  readonly request: LoginRequest;
  readonly resolve: (outcome: LoginOutcome) => void;
}

let pending: PendingLogin | null = null;
const listeners = new Set<() => void>();

function publish(next: PendingLogin | null): void {
  pending = next;
  for (const listener of listeners) listener();
}

/** Store contract for `useSyncExternalStore`. */
export const loginRequestStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): PendingLogin | null => pending,
};

/** Opens the login dialog; a request already open is cancelled first. */
export function requestLogin(request: LoginRequest): Promise<LoginOutcome> {
  pending?.resolve('cancelled');
  return new Promise((resolve) => publish({ request, resolve }));
}

/** Closes the dialog with `outcome`. */
export function settleLogin(outcome: LoginOutcome): void {
  if (pending === null) throw new Error('No login request is open');
  const { resolve } = pending;
  publish(null);
  resolve(outcome);
}

/**
 * hookAlert — shared alert-state contract for werewolf room hooks.
 *
 * Hooks cannot render JSX, so dialogs are exposed as state: each hook owns a
 * `HookAlertState | null` and returns it as `alert` plus a `clearAlert`
 * callback. The screen renders one <AlertModal> per hook.
 *
 * Local type only — must not import from `@/utils/alert` (banned by the
 * architecture contract test). Button shape comes from `@/components/AlertModal`.
 */
import type { AlertButton } from '@/components/AlertModal';

export interface HookAlertState {
  readonly title: string;
  readonly message?: string;
  readonly buttons: AlertButton[];
}

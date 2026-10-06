/**
 * hookAlert — Shared alert state type for werewolf room hooks.
 *
 * Hooks cannot render JSX, so they expose alert state for the screen to render
 * via <AlertModal>. This keeps a single AlertButton type (from AlertModal)
 * without importing from @/utils/alert (banned by the architecture contract test).
 */

import type { AlertButton, AlertInputConfig } from '@/components/AlertModal';

export interface HookAlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: AlertInputConfig;
}

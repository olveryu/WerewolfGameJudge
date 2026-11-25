import type { IoniconName } from '@/components/icons/IonIcon';

export type RoomActionAudience = 'participant' | 'anyone';

export type RoomActionCategory = 'player' | 'resource' | 'host' | 'danger';

export type RoomActionState =
  | { readonly kind: 'ready'; readonly onPress: () => void }
  | { readonly kind: 'busy' }
  | { readonly kind: 'blocked'; readonly reason: string | null };

export const COMMAND_IN_FLIGHT_REASON = '有操作正在提交，请稍候';

/** Resolves the shared single-flight state for one command-backed action. */
export function resolveCommandActionState(input: {
  readonly key: string;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly whenIdle: RoomActionState;
}): RoomActionState {
  if (!input.isSubmitting) return input.whenIdle;
  return input.pendingActionKey === input.key
    ? { kind: 'busy' }
    : { kind: 'blocked', reason: COMMAND_IN_FLIGHT_REASON };
}

export interface RoomAction {
  readonly key: string;
  readonly label: string;
  readonly category: RoomActionCategory;
  readonly icon?: IoniconName;
  readonly testID?: string;
  readonly opensDialog?: boolean;
  readonly state: RoomActionState;
}

export interface RoomPlayerAction extends RoomAction {
  readonly audience: RoomActionAudience;
  readonly isPending?: boolean;
}

export interface RoomPlayerActionGroup {
  /** Scoped by the game to the step it belongs to; a new scope is a new group. */
  readonly key: string;
  readonly label: string;
  readonly icon?: IoniconName;
  readonly audience: RoomActionAudience;
  readonly isPending: boolean;
  readonly testID?: string;
  readonly backTestID?: string;
  readonly actions: readonly RoomPlayerAction[];
}

export interface RoomHostAction extends RoomAction {
  readonly icon: IoniconName;
  readonly stageMenuRole?: 'abort';
}

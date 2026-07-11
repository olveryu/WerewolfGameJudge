/** Game-neutral render model for the shared three-tier bottom panel. */

interface RoomBottomButtonBase {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly size: 'lg' | 'md';
  readonly testID?: string;
  readonly textColor?: string;
  readonly buttonColor?: string;
}

export type RoomBottomButton = RoomBottomButtonBase &
  (
    | {
        readonly isEnabled: true;
        readonly onPress: () => void;
      }
    | {
        readonly isEnabled: false;
        readonly disabledReason: string | null;
        readonly onDisabledPress: (() => void) | null;
      }
  );

export interface RoomBottomActionLayout {
  readonly primary: readonly RoomBottomButton[];
  readonly secondary: readonly RoomBottomButton[];
  readonly ghost: readonly RoomBottomButton[];
}

export interface RoomBottomActionModel {
  readonly message: string | null;
  readonly layout: RoomBottomActionLayout;
}

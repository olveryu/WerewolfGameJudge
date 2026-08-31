/** Game-neutral render models for stacked and compact room action panels. */

type RoomBottomActionAvailability =
  | {
      readonly isEnabled: true;
      readonly onPress: () => void;
    }
  | {
      readonly isEnabled: false;
      readonly disabledReason: string | null;
      readonly onDisabledPress: (() => void) | null;
    };

interface RoomBottomButtonBase {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly size: 'lg' | 'md';
  readonly testID?: string;
  readonly textColor?: string;
  readonly buttonColor?: string;
  readonly isLoading?: boolean;
}

export type RoomBottomButton = RoomBottomButtonBase & RoomBottomActionAvailability;

interface RoomBottomToolButtonBase {
  readonly key: string;
  readonly label: string;
  readonly tone: 'default' | 'danger';
  readonly testID?: string;
}

export type RoomBottomToolButton = RoomBottomToolButtonBase & RoomBottomActionAvailability;

export interface RoomBottomActionLayout {
  readonly primary: readonly RoomBottomButton[];
  readonly secondary: readonly RoomBottomButton[];
  readonly ghost: readonly RoomBottomButton[];
}

export interface RoomBottomStackModel {
  readonly kind: 'stacked';
  readonly message: string | null;
  readonly layout: RoomBottomActionLayout;
}

export interface RoomBottomInfoModel {
  readonly kind: 'info';
  readonly message: string | null;
  readonly actions: readonly RoomBottomButton[];
}

export interface RoomBottomDockModel {
  readonly kind: 'dock';
  readonly message: string | null;
  readonly leading: RoomBottomToolButton | null;
  readonly primary: RoomBottomButton;
  readonly trailing: RoomBottomToolButton | null;
}

export type RoomBottomActionModel =
  | RoomBottomStackModel
  | RoomBottomInfoModel
  | RoomBottomDockModel;

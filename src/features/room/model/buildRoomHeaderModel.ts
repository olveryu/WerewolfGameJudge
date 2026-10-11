/** Builds the shared room header model from header primitives. */

import type { RoomHeaderModel } from './RoomShellModel';

/** The gacha balances the header surfaces as a single ticket count. */
export interface RoomHeaderGachaStatus {
  readonly normalDraws: number;
  readonly goldenDraws: number;
}

export interface BuildRoomHeaderModelInput {
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
}

/**
 * The one header assembly: title handlers pass through, and the user
 * action carries the summed gacha ticket count (null while the balance
 * is unknown). Six games previously inlined this block verbatim in
 * their shell literals; werewolf's factory takes the precomputed count.
 */
export function buildRoomHeaderModel(input: BuildRoomHeaderModelInput): RoomHeaderModel {
  return {
    onBack: input.onBack,
    onTitlePress: input.onTitlePress,
    onTitleLongPress: input.onTitleLongPress,
    userAction: {
      user: input.user,
      ticketCount: input.gachaStatus
        ? input.gachaStatus.normalDraws + input.gachaStatus.goldenDraws
        : null,
      onPress: input.onUserActionPress,
    },
  };
}

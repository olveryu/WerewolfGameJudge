/** Werewolf-only extension rendered inside the shared player profile card. */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import { CampDistributionBar } from '@/components/CampDistributionBar';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';

export const WEREWOLF_PROFILE_GAME_DETAILS = {
  title: '阵营分布',
  render: (profile) => <CampDistributionBar campStats={profile.campStats} compact />,
} satisfies NonNullable<RoomProfileCardModel['gameDetails']>;

export function resolveWerewolfBuiltinAvatarName(avatarId: string): string {
  return getRoleDisplayName(avatarId);
}

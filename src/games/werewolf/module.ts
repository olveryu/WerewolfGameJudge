/** Werewolf client runtime registration. */

import type { GameUiModule } from '@/features/room/model/GameUiModule';
import { WerewolfAccountStatsSection } from '@/games/werewolf/components/WerewolfAccountStatsSection';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';

export const werewolfUiModule = {
  gameType: 'werewolf',
  roomScreen: WerewolfRoomScreen,
  accountStatsSection: WerewolfAccountStatsSection,
} satisfies GameUiModule<'werewolf'>;

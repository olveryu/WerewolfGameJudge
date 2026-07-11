/** Werewolf client runtime registration. */

import type { GameUiModule } from '@/features/room/model/GameUiModule';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';

export const werewolfUiModule = {
  gameType: 'werewolf',
  roomScreen: WerewolfRoomScreen,
} satisfies GameUiModule<'werewolf'>;

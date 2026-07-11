/** Werewolf client runtime registration. */

import type { GameUiModule } from '@/features/room/model/GameUiModule';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';

export const werewolfUiModule = {
  gameType: 'werewolf',
  roomScreen: RoomScreen,
} satisfies GameUiModule<'werewolf'>;

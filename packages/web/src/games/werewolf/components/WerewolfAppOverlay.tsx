/** Werewolf-owned app overlay bound to the Werewolf room session: the AI chat bubble. */

import { type GameState, GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';

import { AIChatBubble } from './AIChatBubble/AIChatBubble';

function isPastSeating(state: GameState): boolean {
  return state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated;
}

export function WerewolfAppOverlay({ session }: { readonly session: WerewolfRoomSession }) {
  const room = useRoomLinkSnapshot(session);
  if (room.phase !== 'ready') return null;

  return (
    <AIChatBubble
      key={`${room.identity.userId}:${room.identity.room.roomId}`}
      session={session}
      identity={room.identity}
      triggerPulse={isPastSeating(room.room.state)}
    />
  );
}

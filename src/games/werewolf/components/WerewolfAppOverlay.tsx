/** Werewolf-owned global overlay bound to one Werewolf room session. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';

import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { AIChatBubble } from '@/games/werewolf/components/AIChatBubble';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';

interface WerewolfAppOverlayProps {
  readonly session: WerewolfRoomSession;
}

export const WerewolfAppOverlay: React.FC<WerewolfAppOverlayProps> = ({ session }) => {
  const room = useRoomLinkSnapshot(session);
  if (room.phase !== 'ready') return null;

  const triggerPulse =
    room.room.state.status !== GameStatus.Unseated && room.room.state.status !== GameStatus.Seated;

  return (
    <AIChatBubble
      key={`${room.identity.userId}:${room.identity.room.roomId}`}
      session={session}
      identity={room.identity}
      triggerPulse={triggerPulse}
    />
  );
};

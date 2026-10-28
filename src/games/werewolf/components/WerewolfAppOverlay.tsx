/** Werewolf-owned global overlay bound to one Werewolf client runtime. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';

import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { AIChatBubble } from '@/games/werewolf/components/AIChatBubble';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

interface WerewolfAppOverlayProps {
  readonly client: WerewolfGameClient;
}

export const WerewolfAppOverlay: React.FC<WerewolfAppOverlayProps> = ({ client }) => {
  const room = useRoomLinkSnapshot(client.roomSession);
  if (room.phase !== 'ready') return null;

  const triggerPulse =
    room.room.state.status !== GameStatus.Unseated && room.room.state.status !== GameStatus.Seated;

  return (
    <AIChatBubble
      key={`${room.identity.userId}:${room.identity.room.roomId}`}
      client={client}
      identity={room.identity}
      triggerPulse={triggerPulse}
    />
  );
};

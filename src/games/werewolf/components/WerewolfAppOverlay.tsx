/** Werewolf-owned global overlay bound to one Werewolf client runtime. */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type React from 'react';

import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { AIChatBubble } from '@/games/werewolf/components/AIChatBubble';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

interface WerewolfAppOverlayProps {
  readonly client: WerewolfGameClient;
}

export const WerewolfAppOverlay: React.FC<WerewolfAppOverlayProps> = ({ client }) => {
  const room = useRoomSessionSnapshot(client.roomSession);
  if (room.phase !== 'ready') return null;

  const triggerPulse =
    room.snapshot.state.status !== GameStatus.Unseated &&
    room.snapshot.state.status !== GameStatus.Seated;

  return <AIChatBubble client={client} triggerPulse={triggerPulse} />;
};

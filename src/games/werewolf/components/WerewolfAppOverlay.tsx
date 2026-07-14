/** Werewolf-owned global overlay bound to one Werewolf client runtime. */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type React from 'react';

import { AIChatBubble } from '@/components/AIChatBubble';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

interface WerewolfAppOverlayProps {
  readonly client: WerewolfGameClient;
}

export const WerewolfAppOverlay: React.FC<WerewolfAppOverlayProps> = ({ client }) => {
  const room = useRoomSessionSnapshot(client.roomSession);
  const triggerPulse =
    room.phase === 'ready' &&
    room.snapshot.state.status !== GameStatus.Unseated &&
    room.snapshot.state.status !== GameStatus.Seated;

  return <AIChatBubble client={client} triggerPulse={triggerPulse} />;
};

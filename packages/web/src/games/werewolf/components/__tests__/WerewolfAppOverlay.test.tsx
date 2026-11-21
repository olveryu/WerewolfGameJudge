import {
  type GameState,
  GameStatus,
  WEREWOLF_STATE_VERSION,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { render, screen } from '@testing-library/react';

import type { RoomIdentity } from '@/platform/realtime/types';
import {
  createFakeRoomLink,
  idleLinkSnapshot,
  readyLinkSnapshot,
  testIdentity,
} from '@/test-utils/linkSnapshot';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { WerewolfAppOverlay } from '../WerewolfAppOverlay';

vi.mock('@/games/werewolf/components/AIChatBubble/AIChatBubble', () => ({
  AIChatBubble: ({
    triggerPulse,
    identity,
  }: {
    readonly triggerPulse: boolean;
    readonly identity: RoomIdentity;
  }) => <p>{`bubble for ${identity.userId}, pulse ${String(triggerPulse)}`}</p>,
}));

function readySession(status: GameStatus) {
  return createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot<GameState>(testIdentity('werewolf'), {
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      revision: 1,
      state: buildWerewolfTestState({ status }),
    }),
  );
}

describe('WerewolfAppOverlay', () => {
  it('does not mount Werewolf UI without an active Werewolf room session', () => {
    const session = createFakeRoomLink<GameState, WerewolfPublicCommand>(
      idleLinkSnapshot<GameState>(),
    );

    const { container } = render(<WerewolfAppOverlay session={session} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [GameStatus.Seated, false],
    [GameStatus.Ongoing, true],
  ])('mounts for a ready Werewolf room in %s with pulse=%s', async (status, triggerPulse) => {
    render(<WerewolfAppOverlay session={readySession(status)} />);

    expect(
      await screen.findByText(`bubble for host, pulse ${String(triggerPulse)}`),
    ).toBeInTheDocument();
  });
});

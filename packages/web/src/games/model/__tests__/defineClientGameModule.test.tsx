import {
  AVALON_STATE_CODEC,
  type AvalonPublicCommand,
  type AvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render, screen } from '@testing-library/react';

import { avalonGameNavigation } from '@/games/avalon/navigation/avalonGameNavigation';
import { avalonReview } from '@/games/avalon/review/avalonReview';
import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import type { RoomLink } from '@/platform/realtime/types';
import { AudioService } from '@/services/infra/AudioService';
import { createFakeRoomLink, idleLinkSnapshot } from '@/test-utils/linkSnapshot';

describe('defineClientGameModule', () => {
  it('binds a game-owned config flow page, not the schema page, to the module session', () => {
    let createdLink: object | null = null;
    let receivedSession: object | null = null;
    const roomLinks: RoomLinkFactory = {
      create: <TState extends BaseGameState<string>, TCommand extends object>() => {
        const link = createFakeRoomLink<TState, TCommand>(idleLinkSnapshot<TState>());
        createdLink = link;
        return link;
      },
      releaseOutside: vi.fn(),
    };
    function CustomConfigFlow({
      session,
    }: {
      readonly session: RoomLink<AvalonState, AvalonPublicCommand>;
    }) {
      receivedSession = session;
      return <p>custom flow</p>;
    }

    const createModule = defineClientGameModule<'avalon', AvalonState, AvalonPublicCommand>({
      gameType: 'avalon',
      displayName: '阿瓦隆',
      stateCodec: AVALON_STATE_CODEC,
      navigation: avalonGameNavigation,
      RoomScreen: () => null,
      config: () => CustomConfigFlow,
      GuideScreen: () => null,
      review: avalonReview,
      isUserSeated: () => false,
      canSwitchAccount: () => true,
    });
    const module = createModule({ roomLinks, audioService: new AudioService() });
    const capability = module.navigation.config;
    if (capability.kind !== 'screen') throw new Error('expected a config screen');
    render(<capability.Screen />);

    expect(screen.getByText('custom flow')).toBeInTheDocument();
    expect(receivedSession).not.toBeNull();
    expect(receivedSession).toBe(createdLink);
  });
});

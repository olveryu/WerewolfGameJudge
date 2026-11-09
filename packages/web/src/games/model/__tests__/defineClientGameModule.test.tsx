import {
  DEMO_STATE_CODEC,
  type DemoCommand,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render, screen } from '@testing-library/react';

import { demoGameNavigation } from '@/games/demo/navigation/demoGameNavigation';
import { demoReview } from '@/games/demo/review/demoReview';
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
    function CustomConfigFlow({ session }: { readonly session: RoomLink<DemoState, DemoCommand> }) {
      receivedSession = session;
      return <p>custom flow</p>;
    }

    const createModule = defineClientGameModule<'demo', DemoState, DemoCommand>({
      gameType: 'demo',
      displayName: 'Demo',
      stateCodec: DEMO_STATE_CODEC,
      navigation: demoGameNavigation,
      RoomScreen: () => null,
      config: () => CustomConfigFlow,
      GuideScreen: () => null,
      review: demoReview,
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

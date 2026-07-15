/** Compile-only client plugin proving navigation, room UI, and session authoring stay open. */

import type React from 'react';

import {
  type PictionaryCommand,
  type PictionaryState,
  pictionaryStateCodec,
  PICTURE_DICTIONARY_GAME_TYPE,
} from '../../packages/game-engine/type-tests/pictionaryModule';
import {
  bindGameNavigation,
  defineGameNavigation,
} from '../../src/features/navigation/model/GameNavigationContribution';
import type { RoomAccountCapability } from '../../src/features/room/model/RoomAccountCapability';
import type { GameRoomScreenProps } from '../../src/features/room/model/RoomUiModule';
import { CLIENT_GAME_PLUGIN_CATALOG } from '../../src/games/catalog';
import {
  type ClientGameModule,
  registerClientGameModule,
} from '../../src/games/model/ClientGameCatalog';
import type { ClientGamePluginDefinition } from '../../src/games/model/ClientGamePlugin';
import type { RealtimeUserEventCodec } from '../../src/services/types/IRealtimeTransport';

interface PictionaryUserEvent {
  readonly type: 'PICTIONARY_PROMPT_READY';
  readonly eventId: string;
}

const PictionaryRoomScreen: React.FC<
  GameRoomScreenProps<typeof PICTURE_DICTIONARY_GAME_TYPE>
> = () => null;
const EmptyScreen: React.FC = () => null;

const pictionaryNavigationDefinition = defineGameNavigation({
  gameType: PICTURE_DICTIONARY_GAME_TYPE,
  config: {
    kind: 'screen',
    parseParams: (): never => {
      throw new Error('Compile-only Pictionary route parser must not execute');
    },
  },
  guide: { kind: 'unsupported' },
  notepad: { kind: 'unsupported' },
});

const pictionaryNavigation = bindGameNavigation(pictionaryNavigationDefinition, {
  config: EmptyScreen,
});

const pictionaryRoomAccount: RoomAccountCapability<typeof PICTURE_DICTIONARY_GAME_TYPE> = {
  gameType: PICTURE_DICTIONARY_GAME_TYPE,
  getSnapshot: () => ({
    gameType: PICTURE_DICTIONARY_GAME_TYPE,
    phase: 'idle',
    isSeated: false,
    canSwitchAccount: true,
    canSyncProfile: false,
  }),
  subscribe: () => () => undefined,
  updateProfile: () => Promise.resolve({ success: true }),
  leaveSeat: () => Promise.resolve({ success: true }),
};

const pictionaryClientModule = {
  gameType: PICTURE_DICTIONARY_GAME_TYPE,
  roomScreen: PictionaryRoomScreen,
  home: {
    mode: {
      displayName: '你画我猜',
      subtitle: '绘画猜词',
      iconName: 'bulb-outline',
    },
    spotlight: null,
    announcementTabs: [],
  },
  navigation: pictionaryNavigation,
  roomAccount: pictionaryRoomAccount,
  productUi: {
    getAvatarDisplayName: () => null,
    getRevealEffectPresentation: () => null,
  },
  audioPreview: null,
  accountStatsSection: EmptyScreen,
  appOverlay: null,
} satisfies ClientGameModule<typeof PICTURE_DICTIONARY_GAME_TYPE>;

const pictionaryUserEventCodec: RealtimeUserEventCodec<PictionaryUserEvent> = {
  parse: (): never => {
    throw new Error('Compile-only Pictionary user-event parser must not execute');
  },
};

const pictionaryClientPlugin = {
  gameType: PICTURE_DICTIONARY_GAME_TYPE,
  navigation: pictionaryNavigationDefinition,
  createModule: (dependencies) => {
    const session = dependencies.sessionFactory.create<
      PictionaryState,
      PictionaryCommand,
      PictionaryUserEvent
    >({
      stateCodec: pictionaryStateCodec,
      userEventCodec: pictionaryUserEventCodec,
    });
    void session;
    return pictionaryClientModule;
  },
} satisfies ClientGamePluginDefinition<typeof PICTURE_DICTIONARY_GAME_TYPE>;

void pictionaryClientPlugin;

// @ts-expect-error unregistered identities cannot cross the production client boundary
registerClientGameModule(pictionaryClientModule);

// @ts-expect-error compile-only plugins are not members of the production client catalog
void CLIENT_GAME_PLUGIN_CATALOG.pictionary;

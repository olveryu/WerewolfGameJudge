/**
 * Lazily loaded client game modules, one chunk per game, created once per page load and shared
 * by the room, config and guide routes.
 */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { createContext, type ReactNode, use, useState, useSyncExternalStore } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import type {
  ActiveRoomAccountSnapshot,
  RoomAccountCapability,
} from '@/features/room/model/RoomAccountCapability';
import {
  type ActiveRoomAccountSource,
  createActiveRoomAccountSource,
} from '@/games/activeRoomAccount';
import type {
  ClientGameModule,
  ClientGameModuleDependencies,
  ClientGameModuleFactory,
} from '@/games/model/ClientGameModule';
import { cacheLoad } from '@/utils/cacheLoad';

type ClientGameLoaders = {
  readonly [TGameType in GameType]: () => Promise<ClientGameModuleFactory<TGameType>>;
};

const CLIENT_GAME_LOADERS: ClientGameLoaders = {
  werewolf: async () => (await import('@/games/werewolf/module')).createWerewolfClientModule,
  fibking: async () => (await import('@/games/fibking/module')).createFibClientModule,
  pictionary: async () => (await import('@/games/pictionary/module')).createPictionaryClientModule,
  undercover: async () => (await import('@/games/undercover/module')).createUndercoverClientModule,
  drawguess: async () => (await import('@/games/drawguess/module')).createDrawGuessClientModule,
  storyrelay: async () => (await import('@/games/storyrelay/module')).createStoryRelayClientModule,
  avalon: async () => (await import('@/games/avalon/module')).createAvalonClientModule,
  demo: async () => (await import('@/games/demo/module')).createDemoClientModule,
};

type ClientGameModuleLoads = {
  readonly [TGameType in GameType]: () => Promise<ClientGameModule<TGameType>>;
};

interface ClientGameModules {
  /** The module for `gameType`; the same promise on every call. */
  readonly load: <TGameType extends GameType>(
    gameType: TGameType,
  ) => Promise<ClientGameModule<TGameType>>;
  /** The one active room account across the loaded modules. */
  readonly activeRoomAccount: ActiveRoomAccountSource;
  /** The modules loaded so far, in load order; a new array after each load. */
  readonly loaded: () => readonly ClientGameModule[];
  readonly subscribeLoaded: (listener: () => void) => () => void;
}

function createClientGameModules(
  loadDependencies: () => Promise<ClientGameModuleDependencies>,
): ClientGameModules {
  let loadedModules: readonly ClientGameModule[] = [];
  const loadListeners = new Set<() => void>();
  const loadModule = async <TGameType extends GameType>(
    gameType: TGameType,
  ): Promise<ClientGameModule<TGameType>> => {
    const loader: () => Promise<ClientGameModuleFactory<TGameType>> = CLIENT_GAME_LOADERS[gameType];
    const [createModule, dependencies] = await Promise.all([loader(), loadDependencies()]);
    const module = createModule(dependencies);
    if (module.gameType !== gameType) {
      throw new Error(`[FAIL-FAST] Client module for ${gameType} registered ${module.gameType}`);
    }
    loadedModules = [...loadedModules, module];
    for (const listener of loadListeners) listener();
    return module;
  };
  // A failed chunk load may succeed on retry; only a loaded module stays cached.
  const moduleLoads: ClientGameModuleLoads = {
    werewolf: cacheLoad(() => loadModule('werewolf')),
    fibking: cacheLoad(() => loadModule('fibking')),
    pictionary: cacheLoad(() => loadModule('pictionary')),
    undercover: cacheLoad(() => loadModule('undercover')),
    drawguess: cacheLoad(() => loadModule('drawguess')),
    storyrelay: cacheLoad(() => loadModule('storyrelay')),
    avalon: cacheLoad(() => loadModule('avalon')),
    demo: cacheLoad(() => loadModule('demo')),
  };
  const subscribeLoaded = (listener: () => void) => {
    loadListeners.add(listener);
    return () => {
      loadListeners.delete(listener);
    };
  };
  return {
    load: <TGameType extends GameType>(gameType: TGameType) => {
      const loadGame: () => Promise<ClientGameModule<TGameType>> = moduleLoads[gameType];
      return loadGame();
    },
    activeRoomAccount: createActiveRoomAccountSource({
      current: (): readonly RoomAccountCapability[] =>
        loadedModules.map((module) => module.roomAccount),
      subscribe: subscribeLoaded,
    }),
    loaded: () => loadedModules,
    subscribeLoaded,
  };
}

const ClientGameModulesContext = createContext<ClientGameModules | null>(null);

/** Creates the page's client game modules from the app services. */
export function ClientGameModulesProvider({ children }: { readonly children: ReactNode }) {
  const { loadRoomLinks, loadAudioService } = useServices();
  const [modules] = useState(() =>
    createClientGameModules(async () => {
      const [roomLinks, audioService] = await Promise.all([loadRoomLinks(), loadAudioService()]);
      return { roomLinks, audioService };
    }),
  );
  return <ClientGameModulesContext value={modules}>{children}</ClientGameModulesContext>;
}

/** Suspends until the game's client module has loaded; throws its load failure. */
export function useClientGameModule<TGameType extends GameType>(
  gameType: TGameType,
): ClientGameModule<TGameType> {
  return use(useClientGameModules().load(gameType));
}

function useClientGameModules(): ClientGameModules {
  const modules = use(ClientGameModulesContext);
  if (modules === null) throw new Error('[FAIL-FAST] Missing ClientGameModulesProvider');
  return modules;
}

/** The active room's account operations, or the idle snapshot outside a room. */
export function useActiveRoomAccount(): ActiveRoomAccountSnapshot {
  const { activeRoomAccount } = useClientGameModules();
  return useSyncExternalStore(activeRoomAccount.subscribe, activeRoomAccount.getSnapshot);
}

/**
 * The app overlays of the modules loaded so far. A game's overlay ships in its own chunk and
 * mounts once a page has loaded that game; it decides from its session when to show anything.
 */
export function ClientGameOverlays() {
  const { loaded, subscribeLoaded } = useClientGameModules();
  const modules = useSyncExternalStore(subscribeLoaded, loaded);
  return modules.map((module) => {
    const Overlay = module.appOverlay;
    return Overlay === null ? null : <Overlay key={module.gameType} />;
  });
}

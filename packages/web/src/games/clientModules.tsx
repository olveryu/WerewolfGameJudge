/**
 * Statically imported client game factories. Sessions are created only when requested, once per
 * page load, and shared by the room, config and guide routes.
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
import { createAvalonClientModule } from '@/games/avalon/module';
import { createDemoClientModule } from '@/games/demo/module';
import { createDrawGuessClientModule } from '@/games/drawguess/module';
import { createFibClientModule } from '@/games/fibking/module';
import type {
  ClientGameModule,
  ClientGameModuleDependencies,
  ClientGameModuleFactory,
} from '@/games/model/ClientGameModule';
import { createPictionaryClientModule } from '@/games/pictionary/module';
import { createStoryRelayClientModule } from '@/games/storyrelay/module';
import { createUndercoverClientModule } from '@/games/undercover/module';
import { createWerewolfClientModule } from '@/games/werewolf/module';
import { cacheLoad } from '@/utils/cacheLoad';

type ClientGameFactories = {
  readonly [TGameType in GameType]: ClientGameModuleFactory<TGameType>;
};

const CLIENT_GAME_FACTORIES: ClientGameFactories = {
  werewolf: createWerewolfClientModule,
  fibking: createFibClientModule,
  pictionary: createPictionaryClientModule,
  undercover: createUndercoverClientModule,
  drawguess: createDrawGuessClientModule,
  storyrelay: createStoryRelayClientModule,
  avalon: createAvalonClientModule,
  demo: createDemoClientModule,
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
    const createModule: ClientGameModuleFactory<TGameType> = CLIENT_GAME_FACTORIES[gameType];
    const dependencies = await loadDependencies();
    const module = createModule(dependencies);
    if (module.gameType !== gameType) {
      throw new Error(`[FAIL-FAST] Client module for ${gameType} registered ${module.gameType}`);
    }
    loadedModules = [...loadedModules, module];
    for (const listener of loadListeners) listener();
    return module;
  };
  // Retry failed initialization; cache only a successfully created module.
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
 * The overlays of initialized games. Each mounts only once a page has initialized that game;
 * it decides from its session when to show anything.
 */
export function ClientGameOverlays() {
  const { loaded, subscribeLoaded } = useClientGameModules();
  const modules = useSyncExternalStore(subscribeLoaded, loaded);
  return modules.map((module) => {
    const Overlay = module.appOverlay;
    return Overlay === null ? null : <Overlay key={module.gameType} />;
  });
}

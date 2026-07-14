/** React boundary for the composition-root client game catalog. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';
import { createContext, use, useMemo, useSyncExternalStore } from 'react';

import type { ActiveRoomAccountSnapshot } from '@/features/room/model/RoomAccountCapability';
import { createActiveRoomAccountSource } from '@/games/activeRoomAccount';
import { type ClientGameCatalog, getClientGameModules } from '@/games/catalog';
import { type ClientProductUi, createClientProductUi } from '@/games/productUi';

const ClientGameCatalogContext = createContext<ClientGameCatalog | null>(null);

interface ClientGameCatalogProviderProps {
  readonly catalog: ClientGameCatalog;
  readonly children: React.ReactNode;
}

export const ClientGameCatalogProvider: React.FC<ClientGameCatalogProviderProps> = ({
  catalog,
  children,
}) => <ClientGameCatalogContext value={catalog}>{children}</ClientGameCatalogContext>;

export function useClientGameCatalog(): ClientGameCatalog {
  const catalog = use(ClientGameCatalogContext);
  if (catalog === null) {
    throw new Error('[FAIL-FAST] Missing ClientGameCatalogProvider');
  }
  return catalog;
}

export function useClientGameModule<TGameType extends GameType>(
  gameType: TGameType,
): ClientGameCatalog[TGameType] {
  return useClientGameCatalog()[gameType];
}

export function useActiveRoomAccount(): ActiveRoomAccountSnapshot {
  const catalog = useClientGameCatalog();
  const source = useMemo(
    () =>
      createActiveRoomAccountSource(
        getClientGameModules(catalog).map((module) => module.roomAccount),
      ),
    [catalog],
  );
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

export function useClientProductUi(): ClientProductUi {
  const catalog = useClientGameCatalog();
  return useMemo(
    () => createClientProductUi(getClientGameModules(catalog).map((module) => module.productUi)),
    [catalog],
  );
}

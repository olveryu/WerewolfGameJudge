/** React boundary for the composition-root client game catalog. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';
import { createContext, use } from 'react';

import type { ClientGameCatalog } from '@/games/catalog';

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

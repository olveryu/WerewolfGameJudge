/** React boundary for the composition-root client game catalog. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';
import { createContext, use, useMemo, useSyncExternalStore } from 'react';

import { ClientProductUiProvider } from '@/features/product/context/ClientProductUiContext';
import { createClientProductUi } from '@/features/product/model/ClientProductUi';
import type { ActiveRoomAccountSnapshot } from '@/features/room/model/RoomAccountCapability';
import { createActiveRoomAccountSource } from '@/games/activeRoomAccount';
import { type ClientGameAudioPreview, getClientGameAudioPreviews } from '@/games/audioPreviews';
import { type ClientGameHome, createClientGameHome } from '@/games/home';
import { type ClientGameCatalog, getClientGameModules } from '@/games/model/ClientGameCatalog';

const ClientGameCatalogContext = createContext<ClientGameCatalog | null>(null);

interface ClientGameCatalogProviderProps {
  readonly catalog: ClientGameCatalog;
  readonly children: React.ReactNode;
}

export const ClientGameCatalogProvider: React.FC<ClientGameCatalogProviderProps> = ({
  catalog,
  children,
}) => {
  const productUi = useMemo(
    () => createClientProductUi(getClientGameModules(catalog).map((module) => module.productUi)),
    [catalog],
  );
  return (
    <ClientGameCatalogContext value={catalog}>
      <ClientProductUiProvider value={productUi}>{children}</ClientProductUiProvider>
    </ClientGameCatalogContext>
  );
};

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

export function useClientGameAudioPreviews(): readonly ClientGameAudioPreview[] {
  const catalog = useClientGameCatalog();
  return useMemo(() => getClientGameAudioPreviews(getClientGameModules(catalog)), [catalog]);
}

export function useClientGameHome(): ClientGameHome {
  const catalog = useClientGameCatalog();
  return useMemo(() => createClientGameHome(getClientGameModules(catalog)), [catalog]);
}

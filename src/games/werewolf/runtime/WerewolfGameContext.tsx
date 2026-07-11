/** React injection boundary for the game-owned Werewolf client runtime. */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { WerewolfGameClient } from './WerewolfGameClient';

type WerewolfGameContextValue = {
  client: WerewolfGameClient;
};

const WerewolfGameContext = createContext<WerewolfGameContextValue | null>(null);

interface WerewolfGameProviderProps {
  children: React.ReactNode;
  client: WerewolfGameClient;
}

/** Inject the composition-root Werewolf client. */
export const WerewolfGameProvider: React.FC<WerewolfGameProviderProps> = ({ children, client }) => {
  const value = useMemo(
    () => ({
      client,
    }),
    [client],
  );

  return <WerewolfGameContext value={value}>{children}</WerewolfGameContext>;
};

/**
 * Get the Werewolf client instance.
 *
 * Must be called within a WerewolfGameProvider subtree, otherwise throws.
 */
export const useWerewolfGame = (): WerewolfGameClient => {
  const ctx = use(WerewolfGameContext);
  if (!ctx) {
    throw new Error('[useWerewolfGame] Missing <WerewolfGameProvider> in component tree');
  }
  return ctx.client;
};

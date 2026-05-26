/**
 * GameFacadeContext - Dependency injection for GameFacade
 *
 * The composition root creates the facade instance and injects it via Context,
 * avoiding global holders / implicit dependencies. Provides Context + Provider and useGameFacade hook.
 * Contains no business logic, does not call services directly, does not create facade instances.
 */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';

type GameFacadeContextValue = {
  facade: IGameFacade;
};

const GameFacadeContext = createContext<GameFacadeContextValue | null>(null);

interface GameFacadeProviderProps {
  children: React.ReactNode;
  /** Required: created and injected by the composition root, avoiding global holders / implicit deps. */
  facade: IGameFacade;
}

/** GameFacade injection Provider; the composition root creates and injects the facade. */
export const GameFacadeProvider: React.FC<GameFacadeProviderProps> = ({ children, facade }) => {
  const value = useMemo(
    () => ({
      facade,
    }),
    [facade],
  );

  return <GameFacadeContext value={value}>{children}</GameFacadeContext>;
};

/**
 * Get the GameFacade instance.
 *
 * Must be called within a GameFacadeProvider subtree, otherwise throws.
 */
export const useGameFacade = (): IGameFacade => {
  const ctx = use(GameFacadeContext);
  if (!ctx) {
    throw new Error('[useGameFacade] Missing <GameFacadeProvider> in component tree');
  }
  return ctx.facade;
};

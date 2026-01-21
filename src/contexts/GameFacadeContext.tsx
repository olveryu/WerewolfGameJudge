import React, { createContext, useContext, useMemo } from 'react';

import type { IGameFacade } from '../services/types/IGameFacade';

type GameFacadeContextValue = {
  facade: IGameFacade;
};

const GameFacadeContext = createContext<GameFacadeContextValue | null>(null);

interface GameFacadeProviderProps {
  children: React.ReactNode;
  /** 必填：由 composition root 创建并注入，避免全局 holder/隐式依赖。 */
  facade: IGameFacade;
}

export const GameFacadeProvider: React.FC<GameFacadeProviderProps> = ({ children, facade }) => {
  const value = useMemo(
    () => ({
      facade,
    }),
    [facade],
  );

  return <GameFacadeContext.Provider value={value}>{children}</GameFacadeContext.Provider>;
};

export const useGameFacade = (): IGameFacade => {
  const ctx = useContext(GameFacadeContext);
  if (!ctx) {
    throw new Error('[useGameFacade] Missing <GameFacadeProvider> in component tree');
  }
  return ctx.facade;
};

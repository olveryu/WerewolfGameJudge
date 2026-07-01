/**
 * RoomFacadeContext — dependency injection for room-mode facades.
 *
 * The composition root creates facade instances and injects them once. Screens choose
 * the facade for their room mode through hooks; no per-game provider tree is needed.
 */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { FibFacade } from '@/services/facade/FibFacade';
import type { IGameFacade } from '@/services/types/IGameFacade';

type RoomFacadeContextValue = {
  werewolf: IGameFacade;
  fibking?: FibFacade;
};

const RoomFacadeContext = createContext<RoomFacadeContextValue | null>(null);

interface RoomFacadeProviderProps {
  children: React.ReactNode;
  werewolf: IGameFacade;
  fibking?: FibFacade;
}

export const RoomFacadeProvider: React.FC<RoomFacadeProviderProps> = ({
  children,
  werewolf,
  fibking,
}) => {
  const value = useMemo(() => ({ werewolf, fibking }), [fibking, werewolf]);
  return <RoomFacadeContext value={value}>{children}</RoomFacadeContext>;
};

export const useGameFacade = (): IGameFacade => {
  const ctx = use(RoomFacadeContext);
  if (!ctx) {
    throw new Error('[useGameFacade] Missing <RoomFacadeProvider> in component tree');
  }
  return ctx.werewolf;
};

export const useFibFacade = (): FibFacade => {
  const ctx = use(RoomFacadeContext);
  if (!ctx) {
    throw new Error('[useFibFacade] Missing <RoomFacadeProvider> in component tree');
  }
  if (!ctx.fibking) {
    throw new Error('[useFibFacade] Missing fibking facade in <RoomFacadeProvider>');
  }
  return ctx.fibking;
};

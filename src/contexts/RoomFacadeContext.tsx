/**
 * RoomFacadeContext — dependency injection for room-mode facades.
 *
 * The composition root creates facade instances and injects them once. Screens choose
 * the facade for their room mode through hooks; no per-game provider tree is needed.
 */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { IFibFacade } from '@/services/games/fibking/IFibFacade';
import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';

type RoomFacadeContextValue = {
  werewolf: IWerewolfFacade;
  fibking: IFibFacade;
};

const RoomFacadeContext = createContext<RoomFacadeContextValue | null>(null);

interface RoomFacadeProviderProps {
  children: React.ReactNode;
  werewolf: IWerewolfFacade;
  fibking: IFibFacade;
}

export const RoomFacadeProvider: React.FC<RoomFacadeProviderProps> = ({
  children,
  werewolf,
  fibking,
}) => {
  const value = useMemo(() => ({ werewolf, fibking }), [fibking, werewolf]);
  return <RoomFacadeContext value={value}>{children}</RoomFacadeContext>;
};

export const useWerewolfFacade = (): IWerewolfFacade => {
  const ctx = use(RoomFacadeContext);
  if (!ctx) {
    throw new Error('[useWerewolfFacade] Missing <RoomFacadeProvider> in component tree');
  }
  return ctx.werewolf;
};

export const useFibFacade = (): IFibFacade => {
  const ctx = use(RoomFacadeContext);
  if (!ctx) {
    throw new Error('[useFibFacade] Missing <RoomFacadeProvider> in component tree');
  }
  return ctx.fibking;
};

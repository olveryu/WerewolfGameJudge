/**
 * FibFacadeContext — dependency injection for FibFacade (parallel to GameFacadeContext).
 *
 * The composition root creates the FibFacade instance and injects it via Context.
 * Used by the fibking screens (FibRoom / FibConfig).
 */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { FibFacade } from '@/services/facade/FibFacade';

type FibFacadeContextValue = { facade: FibFacade };

const FibFacadeContext = createContext<FibFacadeContextValue | null>(null);

interface FibFacadeProviderProps {
  children: React.ReactNode;
  facade: FibFacade;
}

export const FibFacadeProvider: React.FC<FibFacadeProviderProps> = ({ children, facade }) => {
  const value = useMemo(() => ({ facade }), [facade]);
  return <FibFacadeContext value={value}>{children}</FibFacadeContext>;
};

/** Get the FibFacade instance. Must be within a <FibFacadeProvider>. */
export const useFibFacade = (): FibFacade => {
  const ctx = use(FibFacadeContext);
  if (!ctx) {
    throw new Error('[useFibFacade] Missing <FibFacadeProvider> in component tree');
  }
  return ctx.facade;
};

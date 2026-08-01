/** Product-wide presentation context assembled once by the game catalog composition root. */

import type React from 'react';
import { createContext, use } from 'react';

import type { ClientProductUi } from '@/features/product/model/ClientProductUi';

const ClientProductUiContext = createContext<ClientProductUi | null>(null);

interface ClientProductUiProviderProps {
  readonly value: ClientProductUi;
  readonly children: React.ReactNode;
}

export const ClientProductUiProvider: React.FC<ClientProductUiProviderProps> = ({
  value,
  children,
}) => <ClientProductUiContext value={value}>{children}</ClientProductUiContext>;

export function useClientProductUi(): ClientProductUi {
  const productUi = use(ClientProductUiContext);
  if (productUi === null) {
    throw new Error('[FAIL-FAST] Missing ClientProductUiProvider');
  }
  return productUi;
}

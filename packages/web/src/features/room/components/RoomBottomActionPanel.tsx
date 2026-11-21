import './RoomBottomActionPanel.css';

import type { ReactNode } from 'react';

import { TESTIDS } from '@/testids';

/** Provides the shared bottom-panel frame for status, task context, and the active hand. */
export function RoomBottomActionPanel({ children }: { readonly children: ReactNode }) {
  return (
    <footer className="bottom-action-panel" data-testid={TESTIDS.bottomActionPanel}>
      {children}
    </footer>
  );
}

/** Compile-only contract: a room renders either seat slots or one game workspace. */
import type { ReactElement } from 'react';

import type { RoomShellProps } from '../src/features/room/components/RoomShell';

declare const element: ReactElement;
declare function acceptContent(content: RoomShellProps['content']): void;

acceptContent({ kind: 'workspace', element });
acceptContent({
  kind: 'seats',
  beforeSeatBoard: element,
  afterSeatBoard: null,
  contextHeader: null,
  sideInspector: null,
});

// @ts-expect-error Workspace content must not carry ignored seat-board slots.
acceptContent({ kind: 'workspace', element, beforeSeatBoard: element });
// @ts-expect-error Workspace content must provide a rendered element.
acceptContent({ kind: 'workspace', element: null });
// @ts-expect-error Seat content must declare its seat-board slots.
acceptContent({ kind: 'seats' });

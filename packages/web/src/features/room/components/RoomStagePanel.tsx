import './RoomStagePanel.css';
import '@/components/PaperboardPanel.css';

import type { ComponentProps } from 'react';

/** Semantic feedback colors on the shared outlined room surface. */
export type RoomStagePanelTone = 'neutral' | 'success' | 'danger';

/** Shared stage surface; games provide content, never their own copy of its frame. */
export function RoomStagePanel({
  className = '',
  tone = 'neutral',
  ...props
}: ComponentProps<'div'> & { readonly tone?: RoomStagePanelTone }) {
  return (
    <div {...props} className={`room-stage-panel paperboard-panel ${className}`} data-tone={tone} />
  );
}

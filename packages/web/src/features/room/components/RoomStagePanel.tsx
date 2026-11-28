import './RoomStagePanel.css';
import '@/components/PaperboardPanel.css';

import type { ComponentProps } from 'react';

/**
 * Colors on the shared outlined room surface: semantic feedback (`success`, `danger`) and the two
 * highlight inks (`primary`, `host`) a game uses to mark one player's private panel.
 */
export type RoomStagePanelTone = 'neutral' | 'success' | 'danger' | 'primary' | 'host';

/**
 * Shared stage surface; games provide content, never their own copy of its frame. `compact`
 * keeps only a slim side padding (the stage HUD lays out its own rows inside).
 */
export function RoomStagePanel({
  tone = 'neutral',
  density = 'regular',
  ...props
}: Omit<ComponentProps<'div'>, 'className' | 'style'> & {
  readonly tone?: RoomStagePanelTone;
  readonly density?: 'regular' | 'compact';
}) {
  return (
    <div
      {...props}
      className="room-stage-panel paperboard-panel"
      data-tone={tone}
      data-density={density}
    />
  );
}

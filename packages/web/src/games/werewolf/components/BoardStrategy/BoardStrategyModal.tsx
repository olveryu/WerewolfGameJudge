/**
 * BoardStrategyModal — board strategy bottom sheet; hidden when boardName is null.
 * Shared by the room screen, the board picker and the encyclopedia.
 */
import { BottomSheet } from '@/components/BottomSheet';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

import { BoardStrategyContent } from './BoardStrategyContent';

export function BoardStrategyModal({
  boardName,
  onClose,
}: {
  readonly boardName: string | null;
  readonly onClose: () => void;
}) {
  if (boardName === null) return null;
  const title = `${boardName} · 攻略`;
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="board-strategy-sheet">
        <header className="board-strategy-sheet-header">
          <h2 className="board-strategy-sheet-title">{title}</h2>
          <IconButton label="关闭" icon={<IconClose aria-hidden />} onClick={onClose} />
        </header>
        <BoardStrategyContent boardName={boardName} />
      </div>
    </BottomSheet>
  );
}

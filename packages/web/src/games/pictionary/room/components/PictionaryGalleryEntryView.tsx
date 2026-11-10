/** One Pictionary gallery entry: kind and position, the drawing or text, and its author. */

import type {
  PictionaryEntry,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  getPictionarySeatDisplayName,
  PICTIONARY_MISSED_ENTRY_TEXT,
} from '@/games/pictionary/model/pictionarySelectors';
import { TESTIDS } from '@/testids';
import IconBrushOutline from '~icons/ion/brush-outline';
import IconChatboxEllipsesOutline from '~icons/ion/chatbox-ellipses-outline';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';
import IconPersonOutline from '~icons/ion/person-outline';

import { PictionaryDrawingImage } from './PictionaryDrawingImage';

const ENTRY_KIND_LABELS = { drawing: '画作', text: '文字', missed: '未完成' } as const;

/** Renders one revealed entry; supplied to GalleryAlbumStage as its renderEntry. */
export function PictionaryGalleryEntryView({
  state,
  entry,
  entryIndex,
}: {
  readonly state: PictionaryState;
  readonly entry: PictionaryEntry;
  readonly entryIndex: number;
}) {
  const authorName = getPictionarySeatDisplayName(state, entry.authorSeat);
  return (
    <article className="pictionary-gallery-entry" data-testid={TESTIDS.pictionaryGalleryEntry}>
      <div className="pictionary-gallery-entry-meta">
        <span className="pictionary-gallery-entry-kind">{ENTRY_KIND_LABELS[entry.kind]}</span>
        <span data-testid={TESTIDS.pictionaryGalleryEntryPosition}>
          第 {entryIndex + 1} / {state.stepIndex + 1} 棒
        </span>
      </div>
      {entry.kind === 'drawing' ? (
        <PictionaryDrawingImage
          roomCode={state.roomCode}
          entryId={entry.id}
          label={`${authorName} 的画作`}
          controlledSeat={null}
        />
      ) : entry.kind === 'text' ? (
        <div className="pictionary-gallery-text-card">
          <IconChatboxEllipsesOutline aria-hidden />
          <p>{entry.text}</p>
        </div>
      ) : (
        <div className="pictionary-gallery-text-card" data-missed>
          <IconCloseCircleOutline aria-hidden />
          <p>{PICTIONARY_MISSED_ENTRY_TEXT}</p>
          <p className="pictionary-gallery-missed-hint">
            原本需要{entry.expectedKind === 'drawing' ? '画一幅画' : '写下猜测'}
          </p>
        </div>
      )}
      <p className="pictionary-gallery-entry-author">
        {entry.kind === 'drawing' ? (
          <IconBrushOutline aria-hidden />
        ) : (
          <IconPersonOutline aria-hidden />
        )}
        {authorName}
      </p>
    </article>
  );
}

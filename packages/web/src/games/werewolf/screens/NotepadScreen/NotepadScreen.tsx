/**
 * NotepadScreen — the werewolf notepad page, opened from the room's 「笔记」 button: one card per
 * seat, the shared public notes, and the faction legend. Reads the active room snapshot;
 * `useNotepad` owns the local persistence.
 */
import './NotepadScreen.css';
import '@/games/werewolf/components/faction.css';

import { useParams } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import { NotepadPanel } from '@/games/werewolf/components/NotepadPanel';
import { useNotepad } from '@/games/werewolf/hooks/useNotepad';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { parseWerewolfNotepadRouteParams } from '@/games/werewolf/navigation/werewolfGameNavigation';
import IconClipboardOutline from '~icons/ion/clipboard-outline';
import IconTrashOutline from '~icons/ion/trash-outline';

const LEGEND = [
  { faction: 'god', label: '神职' },
  { faction: 'villager', label: '平民' },
  { faction: 'wolf', label: '狼人' },
  { faction: 'third', label: '第三方' },
] as const;

export function NotepadScreen({ session }: { readonly session: WerewolfRoomSession }) {
  const { roomCode } = parseWerewolfNotepadRouteParams(useParams());
  const room = useRoomLinkSnapshot(session);
  const notepad = useNotepad(
    room.phase === 'ready' && room.identity.room.roomCode === roomCode
      ? {
          userId: room.identity.userId,
          roomId: room.identity.room.roomId,
          gameState: room.room.state,
        }
      : null,
  );

  return (
    <div className="notepad-page">
      <ScreenHeader title="笔记" parentPath={roomPath(roomCode)}>
        <IconButton
          label="清除笔记"
          icon={<IconTrashOutline aria-hidden />}
          className="notepad-header-button"
          onClick={notepad.clearAll}
        />
      </ScreenHeader>

      <NotepadPanel
        state={notepad.state}
        playerCount={notepad.playerCount}
        roleTags={notepad.roleTags}
        sheriffCandidateStatuses={notepad.sheriffCandidateStatuses}
        isSheriffCandidateStatusAuthoritative={notepad.isSheriffCandidateStatusAuthoritative}
        onNoteChange={notepad.setNote}
        onToggleHand={notepad.toggleHand}
        onSetRole={notepad.setRole}
      />

      <section className="notepad-public" aria-labelledby="notepad-public-label">
        <h2 id="notepad-public-label" className="notepad-public-label">
          <IconClipboardOutline aria-hidden /> 记录
        </h2>
        <div className="notepad-public-row">
          <textarea
            className="notepad-public-input"
            value={notepad.state.publicNoteLeft}
            onChange={(event) => notepad.setPublicNoteLeft(event.target.value)}
            placeholder="自由记录"
            aria-label="自由记录"
          />
          <textarea
            className="notepad-public-input"
            value={notepad.state.publicNoteRight}
            onChange={(event) => notepad.setPublicNoteRight(event.target.value)}
            placeholder="投票记录"
            aria-label="投票记录"
          />
        </div>
      </section>

      <footer className="notepad-legend">
        {LEGEND.map(({ faction, label }) => (
          <span key={faction} className="notepad-legend-item" data-faction={faction}>
            <span className="notepad-legend-dot" aria-hidden />
            {label}
          </span>
        ))}
      </footer>
    </div>
  );
}

/**
 * NotepadScreen — the werewolf notepad page, opened from the room's 「笔记」 button: one card per
 * seat, the shared public notes, and the faction legend. Reads the active room snapshot;
 * `useNotepad` owns the local persistence.
 */
import './NotepadScreen.css';
import '@/games/werewolf/components/faction.css';

import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { useParams } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import { buildNotepadSummary } from '@/games/werewolf/components/AIChatBubble/notepadSummary';
import { NotepadPanel } from '@/games/werewolf/components/NotepadPanel';
import { useNotepad } from '@/games/werewolf/hooks/useNotepad';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { parseWerewolfNotepadRouteParams } from '@/games/werewolf/navigation/werewolfGameNavigation';
import { requestAIChatMessage, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';
import { showConfirmAlert, showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import IconClipboardOutline from '~icons/ion/clipboard-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
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
  const activeNotepadRoom =
    room.phase === 'ready' && room.identity.room.roomCode === roomCode
      ? {
          userId: room.identity.userId,
          roomId: room.identity.room.roomId,
          gameState: room.room.state,
        }
      : null;
  const notepad = useNotepad(activeNotepadRoom);
  const isAIChatAvailable = useAIChatAvailable();

  const handleAIAnalysis = () => {
    const gameState = activeNotepadRoom?.gameState ?? null;
    // The recorder's own identity, from their seat.
    const mySeat = getWerewolfUserSeat(gameState, activeNotepadRoom?.userId ?? null);
    const myRole = mySeat !== null ? gameState?.players[mySeat]?.role : undefined;
    const myRoleInfo =
      mySeat !== null && myRole
        ? { seat: mySeat + 1, roleName: ROLE_SPECS[myRole].displayName }
        : undefined;

    const summary = buildNotepadSummary(
      notepad.state,
      notepad.playerCount,
      myRoleInfo,
      notepad.sheriffCandidateStatuses,
    );
    if (!summary) {
      showErrorAlert('笔记为空', '请先记录一些笔记再进行分析');
      return;
    }

    showConfirmAlert('AI 分析', '将笔记发送给 AI 进行局势分析？', () => {
      requestAIChatMessage({
        fullText: summary,
        displayText: '分析我的笔记',
        maxTokens: 10000,
      });
    });
  };

  return (
    <div className="notepad-page">
      <ScreenHeader title="笔记" parentPath={roomPath(roomCode)}>
        {isAIChatAvailable && (
          <button type="button" className="notepad-ai-button" onClick={handleAIAnalysis}>
            <IconSparklesOutline aria-hidden />
            AI分析
          </button>
        )}
        <IconButton
          label="清除笔记"
          icon={<IconTrashOutline aria-hidden />}
          className="notepad-header-button"
          onClick={() =>
            showDestructiveAlert(
              '清除所有笔记？',
              '本局的发言记录、角色猜测、上警标记和公共记录都会被删除，且无法恢复。',
              '清除',
              notepad.clearAll,
            )
          }
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

/**
 * NotepadPanel — one card per seat: seat number (opens the role-guess picker) with the guessed
 * role badge, the sheriff-candidate tag, and an auto-growing speech note. The card tint follows
 * the guessed role's faction. Receives notepad state and callbacks; never persists.
 */
import './NotepadPanel.css';
import './faction.css';

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import { CenterDialog } from '@/components/CenterDialog';
import { IconButton } from '@/components/IconButton';
import { FACTION_COLOR_MAP } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import type {
  NotepadSheriffCandidateStatus,
  NotepadSheriffCandidateStatuses,
  RoleTagInfo,
  WerewolfNotepadState,
} from '@/games/werewolf/state/WerewolfNotepadState';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';

function sheriffStatusLabel(
  status: NotepadSheriffCandidateStatus | null,
  isAuthoritative: boolean,
): string {
  if (status === 'withdrawn') return '退水';
  if (isAuthoritative && status === null) return '未上警';
  return '上警';
}

function NotepadCard({
  seat,
  sheriffCandidateStatus,
  isSheriffCandidateStatusAuthoritative,
  selectedTag,
  noteText,
  onNoteChange,
  onToggleHand,
  onSeatPress,
}: {
  readonly seat: number;
  readonly sheriffCandidateStatus: NotepadSheriffCandidateStatus | null;
  readonly isSheriffCandidateStatusAuthoritative: boolean;
  readonly selectedTag: RoleTagInfo | null;
  readonly noteText: string;
  readonly onNoteChange: (seat: number, text: string) => void;
  readonly onToggleHand: (seat: number) => void;
  readonly onSeatPress: (seat: number) => void;
}) {
  const isRegistered = sheriffCandidateStatus === 'registered';
  const statusLabel = sheriffStatusLabel(
    sheriffCandidateStatus,
    isSheriffCandidateStatusAuthoritative,
  );

  return (
    <li
      className="notepad-card"
      data-faction={selectedTag === null ? undefined : FACTION_COLOR_MAP[selectedTag.faction]}
    >
      <div className="notepad-card-header">
        <button
          type="button"
          className="notepad-seat-button"
          aria-haspopup="dialog"
          aria-label={`${seat}号 角色猜测：${selectedTag?.shortName ?? '未选择'}`}
          onClick={() => onSeatPress(seat)}
        >
          <span className="notepad-seat-number">{seat}</span>
          <span className="notepad-role-badge" data-empty={selectedTag === null}>
            {selectedTag?.shortName ?? '+'}
          </span>
        </button>
        {isSheriffCandidateStatusAuthoritative ? (
          <span className="notepad-hand-tag" data-active={isRegistered}>
            {statusLabel}
          </span>
        ) : (
          <button
            type="button"
            className="notepad-hand-tag"
            data-active={isRegistered}
            aria-pressed={isRegistered}
            aria-label={`${seat}号上警`}
            onClick={() => onToggleHand(seat)}
          >
            {statusLabel}
          </button>
        )}
      </div>
      <div className="notepad-note" data-value={noteText}>
        <textarea
          rows={1}
          value={noteText}
          placeholder="发言"
          aria-label={`${seat}号发言`}
          onChange={(event) => onNoteChange(seat, event.target.value)}
        />
      </div>
    </li>
  );
}

function RolePickerDialog({
  seat,
  selectedRoleId,
  roleTags,
  onSelect,
  onClose,
}: {
  readonly seat: number;
  readonly selectedRoleId: RoleId | null;
  readonly roleTags: readonly RoleTagInfo[];
  readonly onSelect: (seat: number, roleId: RoleId | null) => void;
  readonly onClose: () => void;
}) {
  return (
    <CenterDialog open onClose={onClose} title={`座位 ${seat} · 角色猜测`}>
      <div className="notepad-role-grid">
        {roleTags.map((tag) => (
          <button
            key={tag.roleId}
            type="button"
            className="notepad-role-option"
            data-faction={FACTION_COLOR_MAP[tag.faction]}
            aria-pressed={selectedRoleId === tag.roleId}
            onClick={() => onSelect(seat, tag.roleId)}
          >
            {tag.shortName}
          </button>
        ))}
        <IconButton
          label="清除角色"
          icon={<IconCloseCircleOutline aria-hidden />}
          className="notepad-role-clear"
          onClick={() => onSelect(seat, null)}
        />
      </div>
    </CenterDialog>
  );
}

export function NotepadPanel({
  state,
  playerCount,
  roleTags,
  sheriffCandidateStatuses,
  isSheriffCandidateStatusAuthoritative,
  onNoteChange,
  onToggleHand,
  onSetRole,
}: {
  readonly state: WerewolfNotepadState;
  readonly playerCount: number;
  readonly roleTags: readonly RoleTagInfo[];
  readonly sheriffCandidateStatuses: NotepadSheriffCandidateStatuses;
  readonly isSheriffCandidateStatusAuthoritative: boolean;
  readonly onNoteChange: (seat: number, text: string) => void;
  readonly onToggleHand: (seat: number) => void;
  readonly onSetRole: (seat: number, roleId: RoleId | null) => void;
}) {
  const [pickerSeat, setPickerSeat] = useState<number | null>(null);
  const seats = Array.from({ length: playerCount }, (_, index) => index + 1);

  const findTag = (roleId: RoleId | null): RoleTagInfo | null =>
    roleId === null ? null : (roleTags.find((tag) => tag.roleId === roleId) ?? null);

  return (
    <div className="notepad-panel">
      <ul className="notepad-list">
        {seats.map((seat) => (
          <NotepadCard
            key={seat}
            seat={seat}
            sheriffCandidateStatus={sheriffCandidateStatuses[seat] ?? null}
            isSheriffCandidateStatusAuthoritative={isSheriffCandidateStatusAuthoritative}
            selectedTag={findTag(state.roleGuesses[seat] ?? null)}
            noteText={state.playerNotes[seat] ?? ''}
            onNoteChange={onNoteChange}
            onToggleHand={onToggleHand}
            onSeatPress={setPickerSeat}
          />
        ))}
      </ul>
      {pickerSeat !== null && (
        <RolePickerDialog
          seat={pickerSeat}
          selectedRoleId={state.roleGuesses[pickerSeat] ?? null}
          roleTags={roleTags}
          onSelect={(seat, roleId) => {
            onSetRole(seat, roleId);
            setPickerSeat(null);
          }}
          onClose={() => setPickerSeat(null)}
        />
      )}
    </div>
  );
}

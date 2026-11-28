import {
  DECRYPTO_TEAMS,
  type DecryptoSeatView,
  type DecryptoTeam,
} from '@game-judge/game-engine/games/decrypto/public';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { TESTIDS } from '@/testids';
import IconSwapHorizontal from '~icons/ion/swap-horizontal';

import type { DecryptoRoomScreenState } from './hooks/useDecryptoRoomState';

const teamNames = { blue: '蓝队', purple: '紫队' } as const;

function TeamMember({
  screen,
  player,
  isEncryptor,
  canMove,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly player: DecryptoSeatView;
  readonly isEncryptor: boolean;
  readonly canMove: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMoveNotice, setShowMoveNotice] = useState(false);
  const nameId = useId();
  const moveNoticeId = useId();
  return (
    <div
      className="decrypto-player-row"
      data-selected={isEncryptor || undefined}
      data-testid={TESTIDS.decryptoTeamMember(player.seat)}
    >
      <div className="decrypto-player-choice">
        <span className="decrypto-seat-number">{player.seat + 1}</span>
        {player.isBot ? (
          <span className="decrypto-player-name">机器人</span>
        ) : (
          <button
            type="button"
            className="decrypto-player-name"
            title={player.displayName}
            aria-label={`${player.seat + 1}号 · ${player.displayName}，查看完整名字`}
            aria-expanded={expanded}
            aria-controls={nameId}
            onClick={() => setExpanded((current) => !current)}
          >
            {player.displayName}
          </button>
        )}
      </div>
      {screen.isHost && (
        <span className="decrypto-team-move">
          <IconButton
            variant="plain"
            label={`将 ${player.displayName} 移到另一队`}
            icon={<IconSwapHorizontal aria-hidden />}
            disabled={screen.isSubmitting}
            aria-disabled={!canMove || undefined}
            aria-describedby={!canMove ? moveNoticeId : undefined}
            onClick={() => {
              if (!canMove) {
                setShowMoveNotice(true);
              } else {
                void screen.submit(
                  '切换队伍',
                  { type: 'decrypto.teams.move', seat: player.seat },
                  { actionKey: `team:${player.seat}` },
                );
              }
            }}
          />
        </span>
      )}
      {!player.isBot && (
        <p className="decrypto-full-name" id={nameId} hidden={!expanded}>
          {player.seat + 1}号 · {player.displayName}
        </p>
      )}
      <p
        className="decrypto-move-notice"
        id={moveNoticeId}
        role="status"
        hidden={canMove || !showMoveNotice}
      >
        本队至少保留 2 人，不能再移出。
      </p>
    </div>
  );
}

function TeamColumn({
  screen,
  team,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly team: DecryptoTeam;
}) {
  const phase = screen.state.phase;
  const fieldId = useId();
  if (phase.kind !== 'teams') return null;
  const members = screen.viewModel.seats.filter((seat) => phase.assignments[seat.seat] === team);
  const encryptor = members.find((seat) => seat.seat === phase.encryptors[team]);
  const isFixed = screen.state.config.encryptorMode === 'fixed';
  return (
    <section
      className={`decrypto-team decrypto-team-${team}`}
      data-testid={TESTIDS.decryptoTeam(team)}
    >
      <h2>
        <span>{teamNames[team]}</span>
        <small>{members.length} 人</small>
      </h2>
      {isFixed && (
        <div className="decrypto-encryptor-slot">
          <label htmlFor={fieldId}>{teamNames[team]}出题人</label>
          <select
            id={fieldId}
            name={`encryptor-${team}`}
            className="decrypto-encryptor-select"
            data-testid={TESTIDS.decryptoEncryptorSelect(team)}
            value={phase.encryptors[team] ?? ''}
            disabled={!screen.isHost || screen.isSubmitting}
            title={
              encryptor === undefined
                ? '待选择'
                : `${encryptor.seat + 1}号 · ${encryptor.displayName}`
            }
            onChange={(event) =>
              void screen.submit(
                '选择出题人',
                { type: 'decrypto.teams.encryptor', team, seat: Number(event.target.value) },
                { actionKey: `encryptor:${team}` },
              )
            }
          >
            <option value="" disabled>
              选择出题人
            </option>
            {members.map((player) => (
              <option key={player.seat} value={player.seat}>
                {player.seat + 1}号 · {player.isBot ? '机器人' : player.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="decrypto-team-members" role="group" aria-label={`${teamNames[team]}成员`}>
        {members.map((player) => (
          <TeamMember
            key={player.seat}
            screen={screen}
            player={player}
            isEncryptor={encryptor?.seat === player.seat}
            canMove={members.length > 2}
          />
        ))}
      </div>
    </section>
  );
}

/** Mandatory post-start team setup, styled with the shared room dialog surfaces. */
export function DecryptoTeamSetup({ screen }: { readonly screen: DecryptoRoomScreenState }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noticeId = useId();
  const [dismissalNotice, setDismissalNotice] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) throw new Error('Decrypto team dialog is missing');
    dialog.setAttribute('closedby', 'none');
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const phase = screen.state.phase;
  if (phase.kind !== 'teams') return null;
  const blueCount = Object.values(phase.assignments).filter((team) => team === 'blue').length;
  const purpleCount = Object.values(phase.assignments).filter((team) => team === 'purple').length;
  const missingEncryptor =
    screen.state.config.encryptorMode === 'fixed' &&
    DECRYPTO_TEAMS.some((team) => phase.encryptors[team] === null);
  return (
    <dialog
      ref={dialogRef}
      className="room-dialog decrypto-team-dialog"
      data-testid={TESTIDS.decryptoTeamDialog}
      aria-labelledby={titleId}
      aria-describedby={dismissalNotice ? noticeId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        setDismissalNotice(true);
      }}
    >
      <header className="room-dialog-header">
        <div className="room-dialog-heading">
          <h1 className="room-dialog-title" id={titleId}>
            确认分队与出题人
          </h1>
          <p className="room-dialog-subtitle">
            {screen.isHost ? '每队至少 2 人' : '每队至少 2 人，等待房主确认分队'}
          </p>
        </div>
      </header>
      <div className="room-dialog-body decrypto-team-body">
        <div className="decrypto-team-columns">
          {DECRYPTO_TEAMS.map((team) => (
            <TeamColumn key={team} screen={screen} team={team} />
          ))}
        </div>
        {dismissalNotice && (
          <p className="decrypto-notice" id={noticeId} role="status">
            请完成分队后继续。
          </p>
        )}
        {blueCount !== purpleCount && (
          <p className="decrypto-notice" role="status">
            两队人数不均，仍可继续。
          </p>
        )}
      </div>
      {screen.isHost && (
        <footer className="room-dialog-footer">
          <Button
            variant="secondary"
            disabled={screen.isSubmitting}
            onClick={() =>
              void screen.submit(
                '随机分队',
                { type: 'decrypto.teams.randomize' },
                { actionKey: 'teams-randomize' },
              )
            }
          >
            重新随机
          </Button>
          <Button
            autoFocus
            data-testid={TESTIDS.decryptoConfirmTeams}
            disabled={screen.isSubmitting || blueCount < 2 || purpleCount < 2 || missingEncryptor}
            onClick={() =>
              void screen.submit(
                '确认分队',
                { type: 'decrypto.teams.confirm' },
                { actionKey: 'teams-confirm' },
              )
            }
          >
            确认分队
          </Button>
        </footer>
      )}
    </dialog>
  );
}

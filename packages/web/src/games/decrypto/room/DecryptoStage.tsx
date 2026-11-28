import {
  DECRYPTO_TEAMS,
  type DecryptoGame,
  type DecryptoTeam,
} from '@game-judge/game-engine/games/decrypto/public';
import { useId, useState } from 'react';

import { Button } from '@/components/Button';
import { TabList, TabPanel, Tabs } from '@/components/Tabs';
import { RoomStagePanel } from '@/features/room/components/RoomStagePanel';
import { confirmAction } from '@/features/room/confirm';
import { TESTIDS } from '@/testids';

import { DecryptoCodeDisplay } from './DecryptoCodeDisplay';
import { DecryptoHistory } from './DecryptoHistory';
import { DecryptoRoundBoard } from './DecryptoRoundBoard';
import { DecryptoTeamSetup } from './DecryptoTeamSetup';
import { DecryptoTiebreak } from './DecryptoTiebreak';
import type { DecryptoRoomScreenState } from './hooks/useDecryptoRoomState';

const teamNames = { blue: '蓝队', purple: '紫队' } as const;

function Preparing({ screen }: { readonly screen: DecryptoRoomScreenState }) {
  return (
    <div className="decrypto-preparing">
      <RoomStagePanel>
        <div className="decrypto-preparing-body">
          <h2>正在准备双方词卡</h2>
          {screen.isHost && (
            <Button
              variant="ghost"
              onClick={() =>
                confirmAction({
                  label: '中止本局？',
                  body: '将保留座位和配置并返回准备，本局不计完成。',
                  tone: 'danger',
                  confirmText: '中止本局',
                  onConfirm: () =>
                    void screen.submit(
                      '中止本局',
                      {
                        type: 'decrypto.game.restart',
                        gameSequence: screen.state.gameSequence,
                        wasEnded: false,
                      },
                      { actionKey: 'restart' },
                    ),
                })
              }
            >
              中止本局
            </Button>
          )}
        </div>
      </RoomStagePanel>
    </div>
  );
}

function StatusCard({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  const isEnded = screen.state.phase.kind === 'ended';
  const label = isEnded
    ? '本局结束'
    : game.step === 'encrypt'
      ? '填写线索'
      : game.step === 'guess'
        ? '解码与拦截'
        : game.step === 'reveal'
          ? '逐步揭晓'
          : game.step === 'continue'
            ? '本轮完成'
            : '平分加赛';
  return (
    <RoomStagePanel>
      <div className="decrypto-status">
        <div className="decrypto-status-title">
          <strong data-testid={TESTIDS.decryptoRound}>第 {game.round} / 8 轮</strong>
          <h2 data-testid={TESTIDS.decryptoHeading}>{label}</h2>
        </div>
        <div className="decrypto-scores">
          {DECRYPTO_TEAMS.map((team) => {
            const seat = game.encryptors?.[team];
            const encryptor = screen.viewModel.seats.find((player) => player.seat === seat);
            return (
              <div key={team} className={`decrypto-score decrypto-score-${team}`}>
                <strong>
                  {teamNames[team]}
                  {screen.viewModel.myTeam === team ? ' · 我方' : ''}
                </strong>
                <span
                  className="decrypto-score-encryptor"
                  data-testid={TESTIDS.decryptoEncryptor(team)}
                  title={
                    encryptor === undefined
                      ? '未指定'
                      : `${encryptor.seat + 1}号 · ${encryptor.displayName}`
                  }
                >
                  出题：
                  {encryptor === undefined
                    ? '未指定'
                    : `${encryptor.seat + 1}号 · ${encryptor.isBot ? '机器人' : encryptor.displayName}`}
                </span>
                <div className="decrypto-score-metrics">
                  <span>
                    拦截 <b>{game.interceptions[team]}/2</b>
                  </span>
                  <span>
                    误解 <b>{game.miscommunications[team]}/2</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </RoomStagePanel>
  );
}

function KeywordCards({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  const headingId = useId();
  const team = screen.viewModel.myTeam;
  if (team === null || game.keywords === null) return null;
  const isEncryptor = game.step === 'encrypt' && game.encryptors?.[team] === screen.effectiveSeat;
  return (
    <section className="decrypto-words" aria-labelledby={headingId}>
      <h2 id={headingId}>我方关键词</h2>
      <div className="decrypto-word-grid" aria-busy={screen.isTakeoverLoading}>
        {game.keywords[team].map((word, index) => (
          <div className="decrypto-word" key={index}>
            <span className="decrypto-keyword-number">{index + 1}</span>
            <strong data-testid={TESTIDS.decryptoKeyword(index)}>
              {screen.isTakeoverLoading ? '…' : word}
            </strong>
          </div>
        ))}
      </div>
      {isEncryptor && !screen.isTakeoverLoading && (
        <RoomStagePanel tone={team === 'purple' ? 'host' : 'primary'}>
          <div className="decrypto-private-code">
            <h3>本轮密码</h3>
            <DecryptoCodeDisplay
              code={game.codes[team]}
              label="本轮密码"
              testId={TESTIDS.decryptoPrivateCode}
            />
          </div>
        </RoomStagePanel>
      )}
    </section>
  );
}

function GameStage({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  const [selection, setSelection] = useState<{ context: string; team: DecryptoTeam } | null>(null);
  const isEnded = screen.state.phase.kind === 'ended';
  const selectionContext = `${game.round}:${game.step}:${game.activeTeam ?? ''}`;
  const selectedTeam =
    selection?.context === selectionContext
      ? selection.team
      : (game.activeTeam ?? screen.viewModel.myTeam ?? 'blue');
  const isTiebreak = !isEnded && (game.step === 'tiebreakSubmit' || game.step === 'tiebreakJudge');
  return (
    <section className="decrypto-stage" data-testid={TESTIDS.decryptoStage} aria-label="解码战舞台">
      <StatusCard screen={screen} game={game} />
      {screen.hasTakeoverError ? (
        <RoomStagePanel>
          <p role="alert">无法读取接管席位的游戏信息。</p>
          <Button onClick={screen.retryTakeover}>重试</Button>
        </RoomStagePanel>
      ) : (
        <>
          {isEnded && game.outcome !== null && (
            <RoomStagePanel>
              <p data-testid={TESTIDS.decryptoOutcome} className="decrypto-outcome" role="status">
                {game.outcome === 'shared'
                  ? '平局：双方共同获胜'
                  : `${teamNames[game.outcome]}获胜`}
              </p>
            </RoomStagePanel>
          )}
          <KeywordCards screen={screen} game={game} />
          {isTiebreak && <DecryptoTiebreak screen={screen} game={game} />}
          <Tabs
            value={selectedTeam}
            onValueChange={(value) => {
              if (value === 'blue' || value === 'purple')
                setSelection({ context: selectionContext, team: value });
            }}
          >
            <TabList
              label="队伍记录"
              variant="underline"
              items={DECRYPTO_TEAMS.map((team) => ({
                value: team,
                label: `${teamNames[team]}记录${screen.viewModel.myTeam === team ? '（我方）' : ''}`,
                testId: TESTIDS.decryptoHistoryTeam(team),
              }))}
            />
            {DECRYPTO_TEAMS.map((team) => (
              <TabPanel key={team} value={team} testId={TESTIDS.decryptoTeamPanel(team)}>
                <div className="decrypto-board">
                  {!isTiebreak && !isEnded && (
                    <DecryptoRoundBoard screen={screen} game={game} team={team} />
                  )}
                  <DecryptoHistory
                    entries={game.history[team]}
                    isOwnTeam={screen.viewModel.myTeam === team}
                  />
                </div>
              </TabPanel>
            ))}
          </Tabs>
        </>
      )}
      {isEnded && screen.isHost && (
        <Button
          data-testid={TESTIDS.decryptoReturnToLobby}
          disabled={screen.isSubmitting}
          onClick={() =>
            void screen.submit(
              '重新开始',
              {
                type: 'decrypto.game.restart',
                gameSequence: screen.state.gameSequence,
                wasEnded: true,
              },
              { actionKey: 'restart' },
            )
          }
        >
          回到房间准备
        </Button>
      )}
    </section>
  );
}

/** Composes the approved score, four-word, team-tab and bounded history layout. */
export function DecryptoStage({ screen }: { readonly screen: DecryptoRoomScreenState }) {
  if (screen.state.phase.kind === 'teams') return <DecryptoTeamSetup screen={screen} />;
  if (screen.state.phase.kind === 'preparing') return <Preparing screen={screen} />;
  const game = screen.viewModel.game;
  if (game === null) return null;
  return (
    <GameStage
      key={`${screen.state.gameSequence}:${game.round}:${screen.effectiveSeat}`}
      screen={screen}
      game={game}
    />
  );
}

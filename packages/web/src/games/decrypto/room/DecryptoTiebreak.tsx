import {
  DECRYPTO_TEAMS,
  type DecryptoGame,
  type DecryptoTeam,
} from '@game-judge/game-engine/games/decrypto/public';
import { useId, useState } from 'react';

import { Button } from '@/components/Button';
import { RoomStagePanel } from '@/features/room/components/RoomStagePanel';
import { TESTIDS } from '@/testids';

import type { DecryptoRoomScreenState } from './hooks/useDecryptoRoomState';

const teamNames = { blue: '蓝队', purple: '紫队' } as const;

function TiebreakSubmit({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  const [guesses, setGuesses] = useState<[string, string, string, string]>(['', '', '', '']);
  const fieldId = useId();
  const team = screen.viewModel.myTeam;
  if (team === null) return <p>两队正在提交加赛答案。</p>;
  if (game.tiebreakGuesses[team] !== null) return <p>本队答案已提交，等待对方。</p>;
  return (
    <form
      className="decrypto-form"
      onSubmit={(event) => {
        event.preventDefault();
        void screen.submit(
          '提交加赛答案',
          { type: 'decrypto.tiebreak.submit', guesses },
          { controlledSeat: screen.controlledSeat, actionKey: 'tiebreak-submit' },
        );
      }}
    >
      {guesses.map((word, index) => (
        <div className="decrypto-clue-field" key={index}>
          <label htmlFor={`${fieldId}-${index}`}>对方 {index + 1} 号词</label>
          <input
            id={`${fieldId}-${index}`}
            className="text-input"
            required
            maxLength={60}
            value={word}
            data-testid={TESTIDS.decryptoTiebreakInput(index)}
            onChange={(event) => {
              const value = event.target.value;
              setGuesses((current) => [
                index === 0 ? value : current[0],
                index === 1 ? value : current[1],
                index === 2 ? value : current[2],
                index === 3 ? value : current[3],
              ]);
            }}
          />
        </div>
      ))}
      <Button
        type="submit"
        data-testid={TESTIDS.decryptoTiebreakSubmit}
        disabled={screen.isSubmitting || guesses.some((word) => !word.trim())}
      >
        提交加赛答案
      </Button>
    </form>
  );
}

function TiebreakJudge({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  const [selectedTeam, setSelectedTeam] = useState<DecryptoTeam>('blue');
  const [correctByTeam, setCorrectByTeam] = useState<
    Readonly<Record<DecryptoTeam, readonly [boolean, boolean, boolean, boolean]>>
  >({ blue: [false, false, false, false], purple: [false, false, false, false] });
  if (!screen.isHost || screen.controlledSeat !== null) return <p>房主正在核对双方加赛答案。</p>;
  const team =
    game.tiebreakJudgements[selectedTeam] === null
      ? selectedTeam
      : DECRYPTO_TEAMS.find((candidate) => game.tiebreakJudgements[candidate] === null);
  if (team === undefined) return <p>双方答案判定完成。</p>;
  const targetTeam = team === 'blue' ? 'purple' : 'blue';
  const guesses = game.tiebreakGuesses[team];
  const correct = correctByTeam[team];
  return (
    <div className="decrypto-form">
      <h3>{teamNames[team]}加赛答案</h3>
      <div className="decrypto-judgement-list">
        {guesses?.map((guess, index) => (
          <label key={index}>
            <input
              type="checkbox"
              checked={correct[index] ?? false}
              data-testid={TESTIDS.decryptoJudgement(index)}
              onChange={(event) => {
                const checked = event.target.checked;
                setCorrectByTeam((current) => {
                  const previous = current[team];
                  return {
                    ...current,
                    [team]: [
                      index === 0 ? checked : previous[0],
                      index === 1 ? checked : previous[1],
                      index === 2 ? checked : previous[2],
                      index === 3 ? checked : previous[3],
                    ],
                  };
                });
              }}
            />
            <span>
              {guess}（正确词：{game.keywords?.[targetTeam][index]}）
            </span>
          </label>
        ))}
      </div>
      <Button
        data-testid={TESTIDS.decryptoSubmitJudgement}
        disabled={screen.isSubmitting || guesses === null}
        onClick={() =>
          void screen.submit(
            '提交加赛判定',
            { type: 'decrypto.tiebreak.judge', team, correct },
            { actionKey: `tiebreak-judge:${team}` },
          )
        }
      >
        提交{teamNames[team]}判定
      </Button>
      {game.tiebreakJudgements[targetTeam] === null && (
        <Button
          variant="secondary"
          data-testid={TESTIDS.decryptoSwitchJudgement}
          onClick={() => setSelectedTeam(targetTeam)}
        >
          切换到{teamNames[targetTeam]}
        </Button>
      )}
    </div>
  );
}

/** Team-private guesses followed by the host's shared tiebreak adjudication. */
export function DecryptoTiebreak({
  screen,
  game,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
}) {
  return (
    <RoomStagePanel className="decrypto-current">
      <h2>{game.step === 'tiebreakSubmit' ? '加赛：猜出对方四个词' : '加赛判定'}</h2>
      {screen.isTakeoverLoading && <p>正在读取接管席位的游戏信息…</p>}
      <fieldset
        className="decrypto-action-fields"
        hidden={screen.isTakeoverLoading}
        disabled={screen.isTakeoverLoading}
      >
        {game.step === 'tiebreakSubmit' ? (
          <TiebreakSubmit screen={screen} game={game} />
        ) : (
          <TiebreakJudge screen={screen} game={game} />
        )}
      </fieldset>
    </RoomStagePanel>
  );
}

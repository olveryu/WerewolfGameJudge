import {
  DECRYPTO_CODES,
  type DecryptoCode,
  type DecryptoGame,
  type DecryptoTeam,
  isDecryptoResultRevealed,
} from '@game-judge/game-engine/games/decrypto/public';
import { useId, useState } from 'react';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomStagePanel } from '@/features/room/components/RoomStagePanel';
import { TESTIDS } from '@/testids';

import { DecryptoCodeDisplay } from './DecryptoCodeDisplay';
import type { DecryptoRoomScreenState } from './hooks/useDecryptoRoomState';

function ClueEntry({
  screen,
  game,
  team,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
  readonly team: DecryptoTeam;
}) {
  const [clues, setClues] = useState<[string, string, string]>(['', '', '']);
  const inputId = useId();
  if (game.clues[team] !== null) return <p>本队线索已提交，等待另一队。</p>;
  if (screen.viewModel.myTeam !== team || screen.effectiveSeat !== game.encryptors?.[team])
    return <p>等待出题人提交线索。</p>;
  return (
    <form
      className="decrypto-form"
      onSubmit={(event) => {
        event.preventDefault();
        void screen.submit(
          '提交线索',
          { type: 'decrypto.clues.submit', clues },
          { controlledSeat: screen.controlledSeat, actionKey: 'clues-submit' },
        );
      }}
    >
      {game.codes[team].map((number, index) => (
        <div className="decrypto-clue-field" key={index}>
          <label htmlFor={`${inputId}-${index}`}>
            {index + 1} · {number}号 {game.keywords?.[team][number - 1]}
          </label>
          <TextField
            id={`${inputId}-${index}`}
            data-testid={TESTIDS.decryptoClueInput(index)}
            value={clues[index]}
            required
            maxLength={60}
            placeholder="填写线索"
            onChange={(event) => {
              const value = event.target.value;
              setClues((current) => [
                index === 0 ? value : current[0],
                index === 1 ? value : current[1],
                index === 2 ? value : current[2],
              ]);
            }}
          />
        </div>
      ))}
      <Button
        type="submit"
        data-testid={TESTIDS.decryptoSubmitClues}
        disabled={screen.isSubmitting || clues.some((clue) => !clue.trim())}
      >
        提交线索
      </Button>
    </form>
  );
}

function GuessEntry({
  screen,
  game,
  team,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
  readonly team: DecryptoTeam;
}) {
  const [choices, setChoices] = useState<readonly [number | null, number | null, number | null]>([
    null,
    null,
    null,
  ]);
  const [picker, setPicker] = useState<number | null>(null);
  const isOwn = screen.viewModel.myTeam === team;
  const myTeam = screen.viewModel.myTeam;
  const kind = isOwn ? 'decode' : 'intercept';
  const submitted =
    myTeam === null ? null : kind === 'decode' ? game.decoded[myTeam] : game.intercepted[myTeam];
  const canAnswer =
    myTeam !== null &&
    game.encryptors?.[myTeam] !== screen.effectiveSeat &&
    (isOwn || game.round > 1);
  const clues = game.clues[team];
  const chooseNumber = (number: number) => {
    if (picker === null) return;
    const updated: [number | null, number | null, number | null] = [...choices];
    const previousIndex = choices.indexOf(number);
    if (previousIndex >= 0) updated[previousIndex] = choices[picker] ?? null;
    updated[picker] = number;
    setChoices(updated);
    setPicker(null);
  };
  const submitGuess = () => {
    const [first, second, third] = choices;
    if (first === null || second === null || third === null)
      throw new Error('Cannot submit an incomplete Decrypto guess');
    const guess: DecryptoCode = [first, second, third];
    void screen.submit(
      isOwn ? '提交解码' : '提交拦截',
      { type: 'decrypto.guess.submit', kind, guess },
      { controlledSeat: screen.controlledSeat, actionKey: `guess:${kind}` },
    );
  };
  return (
    <>
      {!isOwn && game.round === 1 && <p className="decrypto-note">第一轮不拦截，等待对方解码。</p>}
      <ol className="decrypto-current-clues">
        {clues?.map((clue, index) => (
          <li key={index}>
            <span>
              <b>{index + 1}</b> {clue}
            </span>
            {submitted !== null ? (
              <strong>{submitted[index]} 号</strong>
            ) : (
              canAnswer && (
                <button
                  className="decrypto-number"
                  type="button"
                  aria-label={`第${index + 1}条线索 ${clue}，选择编号，当前${choices[index] ?? '未选择'}`}
                  data-testid={TESTIDS.decryptoGuessDigit(kind, index)}
                  onClick={() => setPicker(index)}
                >
                  {choices[index] ?? '选择'}
                </button>
              )
            )}
          </li>
        ))}
      </ol>
      {submitted !== null ? (
        <p role="status">本队答案已提交并锁定。</p>
      ) : canAnswer ? (
        <Button
          data-testid={TESTIDS.decryptoSubmitGuess(kind)}
          disabled={screen.isSubmitting || choices.some((value) => value === null)}
          onClick={submitGuess}
        >
          提交{isOwn ? '解码' : '拦截'}
        </Button>
      ) : myTeam === null ? (
        <p>观战中</p>
      ) : (
        game.encryptors?.[myTeam] === screen.effectiveSeat && (
          <p className="decrypto-note">出题人暂不参与本轮解码和拦截。</p>
        )
      )}
      {picker !== null && !screen.isTakeoverLoading && (
        <RoomDialog
          title={`第 ${picker + 1} 条线索：选择编号`}
          onClose={() => setPicker(null)}
          dismissOnEscape
          footer={null}
        >
          <div className="decrypto-picker">
            {DECRYPTO_CODES.map((number) => (
              <Button
                key={number}
                variant="secondary"
                data-testid={TESTIDS.decryptoNumberOption(number)}
                onClick={() => chooseNumber(number)}
              >
                {number} 号
              </Button>
            ))}
          </div>
          <p className="decrypto-note">选择已使用的编号会交换两条线索的选择。</p>
        </RoomDialog>
      )}
    </>
  );
}

function RevealedAnswers({
  game,
  team,
}: {
  readonly game: DecryptoGame;
  readonly team: DecryptoTeam;
}) {
  const opposingTeam = team === 'blue' ? 'purple' : 'blue';
  const codeVisible = isDecryptoResultRevealed(game, team, 'code');
  const decodeVisible = isDecryptoResultRevealed(game, team, 'decode');
  const interceptVisible = isDecryptoResultRevealed(game, team, 'intercept');
  const isRevealing = game.step === 'reveal' && game.activeTeam === team;
  const interceptIsLatest = isRevealing && !decodeVisible;
  const decodeIsLatest = isRevealing && !codeVisible;
  return (
    <>
      <ol className="decrypto-current-clues">
        {game.clues[team]?.map((clue, index) => (
          <li key={index}>
            <span>
              <b>{index + 1}</b> {clue}
            </span>
            {codeVisible && <strong>正确：{game.codes[team][index]} 号</strong>}
          </li>
        ))}
      </ol>
      <div
        className="decrypto-reveal-results"
        data-first-round={game.round === 1 || undefined}
        aria-live="polite"
        aria-relevant="additions"
      >
        {interceptVisible && game.intercepted[opposingTeam] !== null && (
          <div
            className="decrypto-reveal-result"
            data-latest={interceptIsLatest || undefined}
            data-testid={TESTIDS.decryptoRevealedAnswer(team, 'intercept')}
          >
            <h4>拦截答案</h4>
            <DecryptoCodeDisplay
              code={game.intercepted[opposingTeam]}
              label="拦截答案"
              animated={interceptIsLatest}
            />
          </div>
        )}
        {decodeVisible && game.decoded[team] !== null && (
          <div
            className="decrypto-reveal-result decrypto-reveal-decode"
            data-testid={TESTIDS.decryptoRevealedAnswer(team, 'decode')}
            data-latest={decodeIsLatest || undefined}
          >
            <h4>解码答案</h4>
            <DecryptoCodeDisplay
              code={game.decoded[team]}
              label="解码答案"
              animated={decodeIsLatest}
            />
          </div>
        )}
        {codeVisible && (
          <div
            className="decrypto-reveal-result decrypto-reveal-code"
            data-testid={TESTIDS.decryptoRevealedAnswer(team, 'code')}
            data-latest={isRevealing || undefined}
          >
            <h4>正确密码</h4>
            <DecryptoCodeDisplay code={game.codes[team]} label="正确密码" animated={isRevealing} />
          </div>
        )}
      </div>
      {game.step === 'reveal' && (
        <p className="decrypto-note" role="status">
          正在自动逐步揭晓，答案尚未全部公开。
        </p>
      )}
    </>
  );
}

/** Current team's clue sheet and actions, aligned with its history tab. */
export function DecryptoRoundBoard({
  screen,
  game,
  team,
}: {
  readonly screen: DecryptoRoomScreenState;
  readonly game: DecryptoGame;
  readonly team: DecryptoTeam;
}) {
  const waitingForPrivateAction =
    screen.isTakeoverLoading && (game.step === 'encrypt' || game.step === 'guess');
  return (
    <RoomStagePanel>
      <div className="decrypto-current">
        <h3>{team === 'blue' ? '蓝队' : '紫队'}本轮线索</h3>
        {waitingForPrivateAction && <p>正在读取接管席位的游戏信息…</p>}
        <fieldset
          className="decrypto-action-fields"
          hidden={waitingForPrivateAction}
          disabled={screen.isTakeoverLoading}
        >
          {game.step === 'encrypt' ? (
            <ClueEntry screen={screen} game={game} team={team} />
          ) : game.step === 'guess' ? (
            <GuessEntry screen={screen} game={game} team={team} />
          ) : (
            <RevealedAnswers game={game} team={team} />
          )}
        </fieldset>
        {game.step === 'continue' && game.outcome === null && game.round < 8 && screen.isHost && (
          <Button
            data-testid={TESTIDS.decryptoContinue}
            disabled={screen.isSubmitting}
            onClick={() =>
              void screen.submit(
                '进入下一轮',
                { type: 'decrypto.reveal.continue', gameSequence: screen.state.gameSequence },
                { actionKey: 'round-continue' },
              )
            }
          >
            进入下一轮
          </Button>
        )}
      </div>
    </RoomStagePanel>
  );
}

import {
  DECRYPTO_CODES,
  type DecryptoHistoryEntry,
} from '@game-judge/game-engine/games/decrypto/public';
import { useEffect, useRef, useState } from 'react';

import { TabList, TabPanel, Tabs } from '@/components/Tabs';
import { TESTIDS } from '@/testids';

function ClueArchive({ entries }: { readonly entries: readonly DecryptoHistoryEntry[] }) {
  return (
    <div className="decrypto-history-grid">
      {DECRYPTO_CODES.map((number) => {
        const clues = entries.flatMap((entry) =>
          entry.code.flatMap((value, index) =>
            value === number ? [{ round: entry.round, clue: entry.clues[index] }] : [],
          ),
        );
        return (
          <article className="decrypto-history-card" key={number}>
            <h4>
              <span className="decrypto-history-number">{number}</span>号线索
            </h4>
            {clues.length === 0 ? (
              <p>暂无线索</p>
            ) : (
              <ul>
                {clues.map(({ round, clue }) => (
                  <li key={round}>
                    <span>第 {round} 轮</span>
                    <strong>{clue}</strong>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RoundRecord({
  entry,
  isOwnTeam,
}: {
  readonly entry: DecryptoHistoryEntry;
  readonly isOwnTeam: boolean;
}) {
  const ownGuess = isOwnTeam ? entry.decode : entry.intercept;
  return (
    <article className="decrypto-round-entry" data-testid={TESTIDS.decryptoHistoryEntry}>
      <table>
        <caption data-testid={TESTIDS.decryptoHistoryCaption}>
          第 {entry.round} 轮 · {entry.team === 'blue' ? '蓝队' : '紫队'}
        </caption>
        <thead>
          <tr>
            <th scope="col">线索</th>
            <th scope="col">本队猜测</th>
            <th scope="col">正确编号</th>
          </tr>
        </thead>
        <tbody>
          {entry.clues.map((clue, index) => (
            <tr key={index}>
              <th scope="row">
                <span className="decrypto-clue-order">{index + 1}</span> {clue}
              </th>
              <td>{ownGuess?.[index] ?? '无拦截'}</td>
              <td>
                <strong>{entry.code[index]}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="decrypto-round-answers">
        {isOwnTeam ? (
          <span>
            对方拦截 <b>{entry.intercept?.join(' · ') ?? '首轮无拦截'}</b>
          </span>
        ) : (
          <span>
            对方解码 <b>{entry.decode.join(' · ')}</b>
          </span>
        )}
      </div>
    </article>
  );
}

/** Bounded single-round history and the original numbered clue archive. */
export function DecryptoHistory({
  entries,
  isOwnTeam,
}: {
  readonly entries: readonly DecryptoHistoryEntry[];
  readonly isOwnTeam: boolean;
}) {
  const [view, setView] = useState('clues');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const activeEntry = entries.find((entry) => entry.round === selectedRound) ?? entries.at(-1);
  useEffect(() => {
    const selector = selectorRef.current;
    const selected = selector?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (selector === null || selected === undefined || selected === null) return;
    const bounds = selector.getBoundingClientRect();
    const target = selected.getBoundingClientRect();
    if (target.left < bounds.left) selector.scrollLeft -= bounds.left - target.left;
    if (target.right > bounds.right) selector.scrollLeft += target.right - bounds.right;
  }, [activeEntry?.round, view]);
  return (
    <section className="decrypto-history">
      <h3>历史</h3>
      <Tabs value={view} onValueChange={setView}>
        <TabList
          label="历史查看方式"
          variant="underline"
          items={[
            { value: 'clues', label: '历史线索' },
            { value: 'rounds', label: '往轮记录', testId: TESTIDS.decryptoHistoryRounds },
          ]}
        />
        <TabPanel value="clues">
          <ClueArchive entries={entries} />
        </TabPanel>
        <TabPanel value="rounds">
          <div className="decrypto-round-history">
            {activeEntry === undefined ? (
              <p className="decrypto-empty-history">暂无已揭晓记录。</p>
            ) : (
              <>
                <div
                  className="decrypto-round-selector"
                  ref={selectorRef}
                  role="group"
                  aria-label="选择查看轮次"
                  data-testid={TESTIDS.decryptoHistoryRound}
                >
                  {entries.map((entry) => (
                    <button
                      key={entry.round}
                      data-testid={TESTIDS.decryptoHistoryRoundButton(entry.round)}
                      className="decrypto-round-button"
                      type="button"
                      aria-label={`第 ${entry.round} 轮`}
                      aria-pressed={entry.round === activeEntry.round}
                      onClick={() => setSelectedRound(entry.round)}
                    >
                      {entry.round}
                    </button>
                  ))}
                </div>
                <RoundRecord entry={activeEntry} isOwnTeam={isOwnTeam} />
              </>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </section>
  );
}

import '@/features/room/components/RoomRecord.css';
import './SecrethitlerHistory.css';

import type {
  SecrethitlerState,
  SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useState } from 'react';

import { SeatDot } from '@/components/SeatDot';
import { formatPendingSeats } from '@/features/room/components/PendingSeatsRow';
import IconCheckmark from '~icons/ion/checkmark';
import IconClose from '~icons/ion/close';

import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import {
  formatSecrethitlerVoteMode,
  SECRETHITLER_END_COPY,
  SECRETHITLER_POWER_COPY,
  secrethitlerSeatLabel,
} from './secrethitlerPresentation';
import { SecrethitlerRoomTracks } from './SecrethitlerRoomTracks';

type RecordSection = 'governments' | 'policies' | 'actions';
type Government = SecrethitlerViewModel['history']['governments'][number];

const SECTIONS: readonly { readonly key: RecordSection; readonly label: string }[] = [
  { key: 'governments', label: '政府投票' },
  { key: 'policies', label: '政策记录' },
  { key: 'actions', label: '总统行动' },
];

function GovernmentRecord({
  record,
  index,
  state,
  view,
}: {
  readonly record: Government;
  readonly index: number;
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
}) {
  const isCurrent = record.outcome === 'pending' && index === view.history.governments.length - 1;
  const isVoting = isCurrent && state.phase.kind === 'voting';
  if (isVoting && view.pendingVoteSeats === null)
    throw new Error('[FAIL-FAST] Secret Hitler voting view is missing submission progress');
  const isWaitingForReveal = isVoting && view.pendingVoteSeats?.length === 0;
  const outcome =
    record.outcome === 'passed'
      ? '通过'
      : record.outcome === 'rejected'
        ? '未通过'
        : state.phase.kind === 'ended'
          ? '未完成'
          : isVoting && !isWaitingForReveal
            ? '投票中'
            : '等待揭晓';
  if (record.outcome !== 'pending' && record.voteCounts === null)
    throw new Error('[FAIL-FAST] Settled Secret Hitler government has no vote counts');
  return (
    <article className="room-record-card secrethitler-record-card" data-outcome={record.outcome}>
      <div className="secrethitler-record-card-heading">
        <h3>第 {index + 1} 次政府</h3>
        <span className="secrethitler-record-badge" data-outcome={record.outcome}>
          {outcome}
        </span>
      </div>
      <p>
        总统 {record.presidentSeat + 1} 号 · 总理 {record.chancellorSeat + 1} 号
      </p>
      {isVoting && view.pendingVoteSeats !== null && (
        <>
          <p>
            已投 {view.livingSeats.length - view.pendingVoteSeats.length}/{view.livingSeats.length}
          </p>
          {view.pendingVoteSeats.length > 0 && (
            <p>{formatPendingSeats('未投票', view.pendingVoteSeats)}</p>
          )}
          {view.myVote !== null && <p>你投了：{view.myVote === 'ja' ? '赞成' : '反对'}</p>}
        </>
      )}
      {record.voteCounts !== null && (
        <p>
          赞成 {record.voteCounts.ja} · 反对 {record.voteCounts.nein}
        </p>
      )}
      {record.votes !== null ? (
        <ul className="secrethitler-record-ballots" aria-label="逐人投票">
          {record.votes.map(({ seat, vote }) => (
            <li
              key={seat}
              className="secrethitler-record-ballot"
              data-vote={vote}
              aria-label={`${seat + 1}号，${vote === 'ja' ? '赞成' : '反对'}`}
            >
              <SeatDot seat={seat} size="sm" />
              {vote === 'ja' ? <IconCheckmark aria-hidden /> : <IconClose aria-hidden />}
            </li>
          ))}
        </ul>
      ) : record.voteCounts !== null ? (
        <p>暗投模式不公布逐人票</p>
      ) : null}
    </article>
  );
}

function TerminalResults({
  state,
  view,
  mySeat,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
  readonly mySeat: number | null;
}) {
  if (state.phase.kind !== 'ended') return null;
  const phase = state.phase;
  return (
    <section className="secrethitler-record-result">
      <h2>{phase.winner === 'liberal' ? '自由派' : '法西斯阵营'}获胜</h2>
      <p>{SECRETHITLER_END_COPY[phase.reason]}</p>
      <p>
        至少 5 名真人开局并正常结束时，注册玩家获得 33 经验和 3 次普通抽奖；游客和机器人不领取。
      </p>
      <ul className="secrethitler-result-list">
        {view.seats.map((player) => {
          if (player.identity === null) throw new Error('Ended Secret Hitler seat has no identity');
          const won = (player.identity === 'liberal' ? 'liberal' : 'fascist') === phase.winner;
          return (
            <li key={player.seat}>
              <span>
                {secrethitlerSeatLabel(view, player.seat)}
                {player.seat === mySeat ? '（你）' : ''}
                {player.isBot ? '（机器人）' : ''}
              </span>
              <strong>
                {getSecrethitlerIdentityName(player.identity)} · {won ? '获胜' : '落败'}
              </strong>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Match record based exclusively on public history and the current viewer's projection. */
export function SecrethitlerMatchDetails({
  state,
  view,
  mySeat,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
  readonly mySeat: number | null;
}) {
  const [section, setSection] = useState<RecordSection>('governments');
  return (
    <div className="room-record-sheet secrethitler-record">
      <TerminalResults state={state} view={view} mySeat={mySeat} />
      <p className="secrethitler-record-config">
        投票{formatSecrethitlerVoteMode(view.voteMode)} · 存活 {view.livingSeats.length} 人
        {view.vetoUnlocked ? ' · 否决权已解锁' : ''}
      </p>
      <SecrethitlerRoomTracks state={state} view={view} showLatestResult={false} />
      {view.presidentSeat !== null && (
        <p className="secrethitler-record-config">
          总统：{secrethitlerSeatLabel(view, view.presidentSeat)}
          {view.chancellorSeat === null
            ? ''
            : ` · 总理：${secrethitlerSeatLabel(view, view.chancellorSeat)}`}
        </p>
      )}
      {state.phase.kind === 'executive' && (
        <p className="secrethitler-record-config">
          本次权力：{SECRETHITLER_POWER_COPY[state.phase.power]}
        </p>
      )}
      <h2 className="secrethitler-record-section-title">公开对局记录</h2>
      <div className="room-record-tabs" role="group" aria-label="记录分类">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="room-record-tab"
            aria-pressed={section === item.key}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="secrethitler-record-list">
        {section === 'governments' &&
          (view.history.governments.length === 0 ? (
            <p className="room-record-empty">暂无政府投票记录。</p>
          ) : (
            view.history.governments.map((record, index) => (
              <GovernmentRecord
                key={index}
                record={record}
                index={index}
                state={state}
                view={view}
              />
            ))
          ))}
        {section === 'policies' &&
          (view.history.policies.length === 0 ? (
            <p className="room-record-empty">暂无政策记录。</p>
          ) : (
            view.history.policies.map((record, index) => (
              <article
                key={index}
                className="room-record-card secrethitler-record-card"
                data-outcome={record.policy === 'liberal' ? 'passed' : 'rejected'}
              >
                <h3>
                  第 {index + 1} 张 · {record.policy === 'liberal' ? '自由派' : '法西斯'}政策
                </h3>
                <p>{record.source === 'chaos' ? '三次失败自动施行' : '政府施行'}</p>
              </article>
            ))
          ))}
        {section === 'actions' &&
          (view.history.actions.length === 0 ? (
            <p className="room-record-empty">暂无总统行动记录。</p>
          ) : (
            view.history.actions.map((record, index) => (
              <article
                key={index}
                className="room-record-card secrethitler-record-card"
                data-outcome="pending"
              >
                <h3>{SECRETHITLER_POWER_COPY[record.action]}</h3>
                <p>
                  总统 {record.presidentSeat + 1} 号
                  {record.targetSeat === null ? '' : ` · 目标 ${record.targetSeat + 1} 号`}
                </p>
              </article>
            ))
          ))}
      </div>
    </div>
  );
}

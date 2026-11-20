import '@/features/room/components/RoomTrack.css';

import {
  getSecrethitlerPolicyPower,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';

import { SECRETHITLER_POWER_COPY } from './secrethitlerPresentation';

type PolicyCell = { readonly kind: 'liberal' | 'fascist'; readonly number: number };

/** Persistent public policy and election tracks with read-only policy explanations. */
export function SecrethitlerRoomTracks({
  state,
  view,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
}) {
  const [detail, setDetail] = useState<PolicyCell | null>(null);
  const lastResult = state.lastPublicResult;
  const latestCopy =
    lastResult === null
      ? null
      : lastResult.kind === 'government'
        ? `政府${lastResult.approved ? '通过' : '未通过'}`
        : lastResult.kind === 'policy'
          ? `${lastResult.source === 'chaos' ? '混乱自动施行' : '施行'}${lastResult.policy === 'liberal' ? '自由派' : '法西斯'}政策`
          : lastResult.kind === 'veto'
            ? `总统${lastResult.approved ? '同意' : '拒绝'}否决`
            : `${SECRETHITLER_POWER_COPY[lastResult.action]}${lastResult.targetSeat === null ? '' : ` · ${lastResult.targetSeat + 1}号`}`;
  const explain = (cell: PolicyCell) => {
    if (cell.kind === 'liberal')
      return cell.number === 5
        ? '施行第五张自由派政策后，自由派获胜。'
        : '施行五张自由派政策后，自由派获胜。';
    const power = getSecrethitlerPolicyPower(state.config.numberOfPlayers, cell.number);
    const parts = [
      power === null
        ? '此格没有总统权力。'
        : `正常施行此政策后，总统执行${SECRETHITLER_POWER_COPY[power]}。`,
      '混乱自动施行政策时不触发总统权力。',
    ];
    if (cell.number === 3) parts.push('三张法西斯政策施行后，希特勒当选总理将立即获胜。');
    if (cell.number === 5) parts.push('五张法西斯政策施行后，解锁政策否决权。');
    if (cell.number === 6) parts.push('施行第六张法西斯政策后，法西斯阵营获胜。');
    return parts.join('');
  };
  return (
    <>
      <div className="room-track-group">
        {(['liberal', 'fascist'] as const).map((kind) => {
          const count = kind === 'liberal' ? 5 : 6;
          const enacted = kind === 'liberal' ? view.liberalPolicies : view.fascistPolicies;
          const label = kind === 'liberal' ? '自由派' : '法西斯';
          return (
            <div key={kind}>
              <p className="room-track-heading">
                {label}政策 {enacted}/{count}
              </p>
              <ol className="room-track-cells" aria-label={`${label}政策轨道`}>
                {Array.from({ length: count }, (_, index) => {
                  const number = index + 1;
                  const power =
                    kind === 'fascist'
                      ? getSecrethitlerPolicyPower(state.config.numberOfPlayers, number)
                      : null;
                  const effect =
                    number === count
                      ? '胜利'
                      : power === null
                        ? '政策'
                        : SECRETHITLER_POWER_COPY[power];
                  return (
                    <li key={number}>
                      <button
                        type="button"
                        className="room-track-cell"
                        data-state={
                          number <= enacted ? (kind === 'liberal' ? 'success' : 'fail') : 'upcoming'
                        }
                        aria-label={`${label}政策第${number}张，${effect}，${number <= enacted ? '已施行' : '未施行'}，查看规则`}
                        onClick={() => setDetail({ kind, number })}
                      >
                        <strong>{number}</strong>
                        <span>{effect}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
        <div>
          <p className="room-track-heading">选举失败 {view.electionTracker}/3</p>
          <ol className="room-track-cells" aria-label="选举失败轨道">
            {[1, 2, 3].map((number) => (
              <li key={number}>
                <span
                  className="room-track-cell"
                  data-state={number <= view.electionTracker ? 'fail' : 'upcoming'}
                >
                  {number === 3 ? '混乱' : `第${number}次`}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {latestCopy !== null && <p className="room-track-heading">最近结果 · {latestCopy}</p>}
      </div>
      {detail !== null && (
        <RoomDialog
          title={`${detail.kind === 'liberal' ? '自由派' : '法西斯'}政策 ${detail.number}`}
          onClose={() => setDetail(null)}
          allowEscape
          footer={
            <Button variant="secondary" onClick={() => setDetail(null)}>
              关闭
            </Button>
          }
        >
          <p>{explain(detail)}</p>
        </RoomDialog>
      )}
    </>
  );
}

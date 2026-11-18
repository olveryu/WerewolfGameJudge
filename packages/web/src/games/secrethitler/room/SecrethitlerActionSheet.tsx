import type {
  SecrethitlerCommand,
  SecrethitlerPolicy,
  SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import type { ReactNode } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { showConfirmAlert } from '@/utils/alertPresets';

import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import type { SecrethitlerRoomScreenState } from './hooks/useSecrethitlerRoomState';
import { secrethitlerInstruction, secrethitlerSeatLabel } from './secrethitlerPresentation';

/** Private action surface; only the viewer-cropped hand and recognition information render. */
export function SecrethitlerActionSheet({
  screen,
}: {
  readonly screen: Pick<
    SecrethitlerRoomScreenState,
    'viewModel' | 'state' | 'submit' | 'controlledSeat' | 'closeAction' | 'isSubmitting'
  >;
}) {
  const view = screen.viewModel;
  if (view === null) return null;
  const instruction = secrethitlerInstruction(screen.state, view);
  if (instruction.action === null) return null;
  const send = async (label: string, command: SecrethitlerCommand) => {
    if (await screen.submit(label, command, { controlledSeat: screen.controlledSeat }))
      screen.closeAction();
  };
  const button = (label: string, command: SecrethitlerCommand, key = label) => (
    <Button
      key={key}
      variant="secondary"
      disabled={screen.isSubmitting}
      onClick={() => void send(label, command)}
    >
      {label}
    </Button>
  );
  let content: ReactNode = null;
  switch (screen.state.phase.kind) {
    case 'night':
      content = (
        <SecrethitlerNightRecognition
          view={view}
          isSubmitting={screen.isSubmitting}
          onConfirm={() => void send('确认信息', { type: 'secrethitler.night.confirm', step: 1 })}
        />
      );
      break;
    case 'election':
      content = view.eligibleChancellorSeats.map((seat) =>
        button(
          secrethitlerSeatLabel(view, seat),
          { type: 'secrethitler.government.nominate', chancellorSeatId: seat },
          String(seat),
        ),
      );
      break;
    case 'voting':
      content = (
        <>
          <p>
            当前选择：{view.myVote === null ? '尚未投票' : view.myVote === 'ja' ? '赞成' : '反对'}
            。全员提交前可修改。
          </p>
          {button('赞成', { type: 'secrethitler.government.castVote', vote: 'ja' })}
          {button('反对', { type: 'secrethitler.government.castVote', vote: 'nein' })}
        </>
      );
      break;
    case 'legislativePresident':
    case 'legislativeChancellor':
      content = (
        <>
          <p>
            你的手牌：
            {view.myHand?.map((policy) => (policy === 'liberal' ? '自由派' : '法西斯')).join('、')}
          </p>
          {createPolicyButtons(
            view.myHand,
            screen.state.phase.kind === 'legislativePresident' ? 'discard' : 'enact',
            button,
          )}
          {view.canRequestVeto &&
            button('请求否决', { type: 'secrethitler.policy.chancellorResolve', action: 'veto' })}
        </>
      );
      break;
    case 'vetoResponse':
      content = (
        <>
          <p>同意将弃置两张政策并增加一次选举失败；拒绝后总理必须施行一张。</p>
          {button('同意否决', { type: 'secrethitler.policy.vetoRespond', approve: true })}
          {button('拒绝否决', { type: 'secrethitler.policy.vetoRespond', approve: false })}
        </>
      );
      break;
    case 'executive': {
      const power = screen.state.phase.power;
      content =
        power === 'policyPeek' ? (
          <>
            <p>
              牌堆顶三张（顺序不变）：
              {view.policyPreview
                ?.map((policy) => (policy === 'liberal' ? '自由派' : '法西斯'))
                .join('、')}
            </p>
            {button('确认预览', { type: 'secrethitler.action.acknowledgePolicyPeek' })}
          </>
        ) : (
          view.livingSeats
            .filter(
              (seat) =>
                seat !== view.presidentSeat &&
                (power !== 'investigate' || !screen.state.investigatedSeats.includes(seat)),
            )
            .map((seat) => {
              const label = secrethitlerSeatLabel(view, seat);
              const command: SecrethitlerCommand =
                power === 'investigate'
                  ? { type: 'secrethitler.action.investigate', targetSeatId: seat }
                  : power === 'specialElection'
                    ? { type: 'secrethitler.action.specialElection', targetSeatId: seat }
                    : { type: 'secrethitler.action.execute', targetSeatId: seat };
              return (
                <Button
                  key={seat}
                  variant={power === 'execute' ? 'danger' : 'secondary'}
                  disabled={screen.isSubmitting}
                  onClick={() =>
                    showConfirmAlert(
                      instruction.action ?? '确认行动',
                      `确定选择 ${label}？${power === 'execute' ? '处决不可撤销。' : ''}`,
                      () => void send('总统行动', command),
                    )
                  }
                >
                  {label}
                </Button>
              );
            })
        );
      break;
    }
  }
  return (
    <BottomSheet title={instruction.action} onClose={screen.closeAction}>
      <div className="secrethitler-action-content">
        <h2>{instruction.action}</h2>
        {content}
        <Button variant="ghost" onClick={screen.closeAction}>
          关闭
        </Button>
      </div>
    </BottomSheet>
  );
}

function createPolicyButtons(
  hand: readonly SecrethitlerPolicy[] | null,
  action: 'discard' | 'enact',
  button: (label: string, command: SecrethitlerCommand) => ReactNode,
) {
  return [...new Set(hand)].map((policy) => {
    const label = `${action === 'discard' ? '弃置' : '施行'}${policy === 'liberal' ? '自由派' : '法西斯'}政策`;
    return button(
      label,
      action === 'discard'
        ? { type: 'secrethitler.policy.presidentDiscard', policy }
        : { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy },
    );
  });
}

function SecrethitlerNightRecognition({
  view,
  isSubmitting,
  onConfirm,
}: {
  readonly view: SecrethitlerViewModel;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => void;
}) {
  return (
    <>
      <p>仅你获准查看，请勿向全桌展示屏幕。</p>
      <ul>
        {view.knownFascists.map(({ seat, identity }) => (
          <li key={seat}>
            {secrethitlerSeatLabel(view, seat)} · {getSecrethitlerIdentityName(identity)}
          </li>
        ))}
      </ul>
      {view.hasConfirmedNight ? (
        <p>信息已确认</p>
      ) : (
        <Button variant="secondary" disabled={isSubmitting} onClick={onConfirm}>
          确认信息
        </Button>
      )}
    </>
  );
}

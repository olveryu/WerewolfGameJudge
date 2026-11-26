import type { SecrethitlerCommand } from '@game-judge/game-engine/games/secrethitler/public';
import type { ReactNode } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { ChoiceCard } from '@/components/ChoiceCard';
import { RoomPlayerPickModal } from '@/features/room/components/RoomPlayerPickModal';
import { confirmAction } from '@/features/room/confirm';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { formatSettleCountdown } from '@/features/room/model/formatCountdown';
import { TESTIDS } from '@/testids';

import {
  secrethitlerPolicyFascistImage,
  secrethitlerPolicyLiberalImage,
} from '../assets/secrethitlerPolicyImages';
import {
  secrethitlerVoteNoImage,
  secrethitlerVoteYesImage,
} from '../assets/secrethitlerVoteImages';
import type { SecrethitlerRoomScreenState } from './hooks/useSecrethitlerRoomState';
import { secrethitlerInstruction, secrethitlerSeatLabel } from './secrethitlerPresentation';

/** Private action surface for the current government or presidential power. */
export function SecrethitlerActionSheet({
  screen,
}: {
  readonly screen: Pick<
    SecrethitlerRoomScreenState,
    'viewModel' | 'state' | 'submit' | 'controlledSeat' | 'closeAction' | 'isSubmitting'
  >;
}) {
  const { remainingSeconds } = useStageDeadline({
    deadlineAt: screen.state.phase.kind === 'voting' ? screen.state.phase.deadlineAt : null,
  });
  const view = screen.viewModel;
  if (view === null) return null;
  if (screen.state.phase.kind === 'night') return null;
  const instruction = secrethitlerInstruction(screen.state, view);
  if (instruction.action === null) return null;
  if (screen.state.phase.kind === 'election') {
    const phase = screen.state.phase;
    const isFinal = phase.preselectedChancellorSeat !== null;
    return (
      <RoomPlayerPickModal
        title={isFinal ? '最终提名' : '预选总理'}
        hint={isFinal ? '确认后进入投票，无法再更改。' : '确认后预选将公开，最终提名仍可更改。'}
        requiredSize={1}
        initialSelection={
          phase.preselectedChancellorSeat === null ? [] : [phase.preselectedChancellorSeat]
        }
        players={view.seats.map(({ seat }) => ({
          seat,
          label: secrethitlerSeatLabel(view, seat),
          tag: seat === phase.presidentSeat ? '总统' : null,
          isPreselected: isFinal && seat === phase.preselectedChancellorSeat,
          disabledReason: view.eligibleChancellorSeats.includes(seat)
            ? null
            : !view.livingSeats.includes(seat)
              ? '已出局'
              : seat === phase.presidentSeat
                ? '总统不能提名自己'
                : '任期限制',
        }))}
        isSubmitting={screen.isSubmitting}
        confirmLabel={isFinal ? '确认提交' : '确认预选'}
        onConfirm={(seats) => {
          const chancellorSeatId = seats[0];
          if (chancellorSeatId === undefined) throw new Error('Missing selected chancellor');
          void screen
            .submit(
              isFinal ? '提名总理' : '预选总理',
              {
                type: isFinal
                  ? 'secrethitler.government.nominate'
                  : 'secrethitler.government.preselect',
                chancellorSeatId,
              },
              { controlledSeat: screen.controlledSeat, actionKey: null },
            )
            .then((success) => {
              if (success) screen.closeAction();
            });
        }}
        onClose={screen.closeAction}
        testIds={{
          modal: TESTIDS.secrethitlerNominationModal,
          count: TESTIDS.secrethitlerNominationCount,
          row: TESTIDS.secrethitlerNominationRow,
          cancel: TESTIDS.secrethitlerNominationCancel,
          confirm: TESTIDS.secrethitlerNominationConfirm,
        }}
      />
    );
  }
  const mustResolveHand =
    screen.state.phase.kind === 'legislativePresident' ||
    screen.state.phase.kind === 'legislativeChancellor';
  const mustAcknowledgeInformation =
    screen.state.phase.kind === 'executive' && screen.state.phase.power === 'policyPeek';
  const requireConfirmation = mustResolveHand || mustAcknowledgeInformation;
  const send = async (label: string, command: SecrethitlerCommand) => {
    if (
      await screen.submit(label, command, {
        controlledSeat: screen.controlledSeat,
        actionKey: null,
      })
    )
      screen.closeAction();
  };
  const confirm = (label: string, command: SecrethitlerCommand) =>
    confirmAction({ label, onConfirm: () => send(label, command) });
  const button = (label: string, command: SecrethitlerCommand, testId?: string) => (
    <Button
      variant="secondary"
      disabled={screen.isSubmitting}
      data-testid={testId}
      onClick={() => void send(label, command)}
    >
      {label}
    </Button>
  );
  let content: ReactNode = null;
  switch (screen.state.phase.kind) {
    case 'voting':
      content = (
        <>
          <p>
            当前选择：{view.myVote === null ? '尚未投票' : view.myVote === 'ja' ? '赞成' : '反对'}
            。揭晓前可修改。
          </p>
          {remainingSeconds !== null && <p>{formatSettleCountdown(remainingSeconds, '投票')}</p>}
          <div className="choice-row">
            <ChoiceCard
              label="赞成"
              imageSrc={secrethitlerVoteYesImage}
              isSelected={view.myVote === 'ja'}
              isDisabled={screen.isSubmitting || remainingSeconds === 0}
              testId={TESTIDS.secrethitlerVoteYes}
              onClick={() =>
                void send('赞成', { type: 'secrethitler.government.castVote', vote: 'ja' })
              }
            />
            <ChoiceCard
              label="反对"
              imageSrc={secrethitlerVoteNoImage}
              isSelected={view.myVote === 'nein'}
              isDisabled={screen.isSubmitting || remainingSeconds === 0}
              testId={TESTIDS.secrethitlerVoteNo}
              onClick={() =>
                void send('反对', { type: 'secrethitler.government.castVote', vote: 'nein' })
              }
            />
          </div>
        </>
      );
      break;
    case 'legislativePresident':
    case 'legislativeChancellor': {
      const action = screen.state.phase.kind === 'legislativePresident' ? 'discard' : 'enact';
      content = (
        <>
          <div className="choice-row">
            {(view.myHand ?? []).map((policy, index) => {
              const label = `${action === 'discard' ? '弃置' : '施行'}${policy === 'liberal' ? '自由派' : '法西斯'}政策`;
              const command: SecrethitlerCommand =
                action === 'discard'
                  ? { type: 'secrethitler.policy.presidentDiscard', policy }
                  : { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy };
              return (
                <ChoiceCard
                  key={`${policy}-${index}`}
                  label={label}
                  imageSrc={
                    policy === 'liberal'
                      ? secrethitlerPolicyLiberalImage
                      : secrethitlerPolicyFascistImage
                  }
                  isDisabled={screen.isSubmitting}
                  testId={TESTIDS.secrethitlerPolicyCard(action, policy, index)}
                  onClick={() => confirm(label, command)}
                />
              );
            })}
          </div>
          {view.canRequestVeto && (
            <Button
              variant="secondary"
              disabled={screen.isSubmitting}
              data-testid={TESTIDS.secrethitlerVetoRequest}
              onClick={() =>
                confirm('请求否决', {
                  type: 'secrethitler.policy.chancellorResolve',
                  action: 'veto',
                })
              }
            >
              请求否决
            </Button>
          )}
        </>
      );
      break;
    }
    case 'vetoResponse':
      content = (
        <>
          <p>同意将弃置两张政策并增加一次选举失败；拒绝后总理必须施行一张。</p>
          <Button
            variant="secondary"
            disabled={screen.isSubmitting}
            data-testid={TESTIDS.secrethitlerVetoApprove}
            onClick={() =>
              confirm('同意否决', { type: 'secrethitler.policy.vetoRespond', approve: true })
            }
          >
            同意否决
          </Button>
          <Button
            variant="secondary"
            disabled={screen.isSubmitting}
            data-testid={TESTIDS.secrethitlerVetoReject}
            onClick={() =>
              confirm('拒绝否决', { type: 'secrethitler.policy.vetoRespond', approve: false })
            }
          >
            拒绝否决
          </Button>
        </>
      );
      break;
    case 'executive': {
      const power = screen.state.phase.power;
      content =
        power === 'policyPeek' ? (
          <>
            <p>牌堆顶三张（顺序不变）：</p>
            <div className="secrethitler-policy-peek">
              {view.policyPreview?.map((policy, index) => (
                <img
                  key={`${policy}-${index}`}
                  src={
                    policy === 'liberal'
                      ? secrethitlerPolicyLiberalImage
                      : secrethitlerPolicyFascistImage
                  }
                  alt={policy === 'liberal' ? '自由派' : '法西斯'}
                  decoding="async"
                  className="secrethitler-policy-peek-image"
                  data-testid={TESTIDS.secrethitlerPolicyPeekCard(index)}
                />
              ))}
            </div>
            {button(
              '知道了',
              { type: 'secrethitler.action.acknowledgePolicyPeek' },
              TESTIDS.secrethitlerPolicyPeekAcknowledge,
            )}
          </>
        ) : null;
      break;
    }
  }
  if (
    screen.state.phase.kind === 'voting' ||
    screen.state.phase.kind === 'legislativePresident' ||
    screen.state.phase.kind === 'legislativeChancellor'
  ) {
    return (
      <CenterDialog
        open
        title={instruction.action}
        onClose={screen.closeAction}
        requireConfirmation={mustResolveHand}
        testId={TESTIDS.secrethitlerActionModal}
      >
        {content}
        {!mustResolveHand && (
          <Button variant="secondary" size="lg" onClick={screen.closeAction}>
            关闭
          </Button>
        )}
      </CenterDialog>
    );
  }
  return (
    <BottomSheet
      title={instruction.action}
      onClose={screen.closeAction}
      requireConfirmation={requireConfirmation}
      testId={mustAcknowledgeInformation ? TESTIDS.secrethitlerPolicyPeekModal : undefined}
    >
      <div className="secrethitler-action-content">
        <h2>{instruction.action}</h2>
        {content}
        {!requireConfirmation && (
          <Button variant="ghost" onClick={screen.closeAction}>
            关闭
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}

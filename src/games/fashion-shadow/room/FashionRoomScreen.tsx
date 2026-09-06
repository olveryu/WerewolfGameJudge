// Fashion Shadow first-round room UI over the shared room session and redacted server state.

import {
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_BY_ID,
  FASHION_ROLE_IDS,
  FASHION_ROUND_BY_NUMBER,
  type FashionContractPromise,
  type FashionPublicCommand,
  type FashionPublicState,
  type FashionRoleId,
  isFashionBotUserId,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';
import { FashionTutorial } from '@/games/fashion-shadow/tutorial/FashionTutorial';
import {
  hasCompletedFashionTutorial,
  markFashionTutorialCompleted,
} from '@/games/fashion-shadow/tutorial/tutorialProgress';
import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import { getFashionRoomCommandFailureMessage } from './fashionRoomCommandFailureMessage';
import { useFashionSeatCommands } from './useFashionSeatCommands';

interface FashionRoomScreenProps extends GameRoomScreenProps<'fashion-shadow'> {
  readonly session: FashionRoomSession;
}

const PHASE_LABELS: Readonly<Record<FashionPublicState['phase'], string>> = {
  lobby: '等待 7 人入座',
  roleReveal: '确认身份',
  event: '事件公开',
  crossExamination: '交叉质询',
  discussion: '自由讨论',
  vote: '调查投票',
  roundTransition: '轮次结算',
  hearing: '最终听证',
  ended: '游戏结束',
};

function findUserSeat(state: FashionPublicState, userId: string): number | null {
  for (let seat = 0; seat < state.numberOfPlayers; seat += 1) {
    if (state.realSeats[seat]?.userId === userId) return seat;
  }
  return null;
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${String(secondsPart).padStart(2, '0')}`;
}

function getEvidenceTitle(evidenceId: FashionPublicState['publicEvidence'][number]): string {
  for (const roundNumber of [1, 2, 3, 4] as const) {
    const round = FASHION_ROUND_BY_NUMBER[roundNumber];
    if (round.evidenceId === evidenceId) return round.evidenceTitle;
  }
  return evidenceId;
}

const CONTRACT_PROMISE_LABELS: Readonly<Record<FashionContractPromise, string>> = {
  compensation: '经济补偿',
  protection: '人身保护',
  legalImmunity: '法律豁免',
};

function getSecretText(secretId: FashionPublicState['revealedSecrets'][number]): string {
  const role = Object.values(FASHION_ROLE_BY_ID).find((entry) => entry.secretId === secretId);
  return role?.secret ?? secretId;
}

function getCrossExamTask(round: 1 | 2 | 3 | 4, roleId: FashionRoleId): string | null {
  switch (round) {
    case 1:
      if (roleId === 'factoryWorker') return '攻击任务：用更换标签指令追问品牌方为何声称不知情。';
      if (roleId === 'brandExecutive') return '防守任务：解释高层为何不知情，并回应采购部门责任。';
      if (roleId === 'supplierOwner')
        return '攻击任务：用原始订单与发票追问采购总监的签名与改标要求。';
      if (roleId === 'villainProcurementDirector')
        return '防守任务：回应供应商指控，并解释订单与签名。';
      return null;
    case 2:
      if (roleId === 'governmentOfficial') return '攻击任务：围绕排污报告与过往稽查记录追问反派。';
      if (roleId === 'villainProcurementDirector')
        return '防守任务：解释排污问题是否属于工厂层面的失误。';
      if (roleId === 'consumerRepresentative')
        return '攻击任务：用废水超标证据质疑品牌的永续承诺。';
      if (roleId === 'brandExecutive') return '防守任务：回应污染证据，并说明品牌方是否已整改。';
      return null;
    case 3:
      if (roleId === 'journalist') return '攻击任务：用货柜纪录追问品牌高层是否知情系统性瞒报。';
      if (roleId === 'brandExecutive') return '防守任务：解释物流申报异常为何不代表公司政策。';
      if (roleId === 'consumerRepresentative')
        return '攻击任务：追问采购总监为何多次出现约 70% 的申报重量。';
      if (roleId === 'villainProcurementDirector')
        return '防守任务：回应货柜造假是否只是报关或操作失误。';
      return null;
    case 4:
      if (roleId === 'journalist')
        return '攻击任务：用 80 万顾问费与空壳公司金流追问是否存在行贿。';
      if (roleId === 'villainProcurementDirector')
        return '防守任务：解释顾问费、空壳公司与离岸转账的商业理由。';
      if (roleId === 'governmentOfficial')
        return '攻击任务：追问品牌方这笔顾问费与环保署稽查之间的关系。';
      if (roleId === 'brandExecutive')
        return '防守任务：说明品牌方是否知晓或授权这笔环境合规顾问费。';
      return null;
  }
}

export const FashionRoomScreen: React.FC<FashionRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  session,
}) => {
  const handleExit = useCallback(() => exitRoomFlow(navigation), [navigation]);
  return (
    <RoomEntryBoundary room={room} session={session} onExit={handleExit}>
      {(entryController) => (
        <FashionRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          session={session}
          entryController={entryController}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface FashionRoomContentProps extends FashionRoomScreenProps {
  readonly entryController: RoomEntryController;
}

const FashionRoomContent: React.FC<FashionRoomContentProps> = ({ room, navigation, session }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  if (user === null) {
    throw new Error('[FAIL-FAST] Ready Fashion Shadow room requires an authenticated user');
  }
  const sessionSnapshot = useRoomSessionSnapshot(session);
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Fashion Shadow room content requires a ready room session');
  }
  const state = sessionSnapshot.snapshot.state;
  const mySeat = findUserSeat(state, user.id);
  const isHost = state.hostUserId === user.id;
  const occupiedSeats = Object.values(state.realSeats).filter((seat) => seat !== undefined);
  const occupiedCount = occupiedSeats.length;
  const botCount = occupiedSeats.filter((seat) => isFashionBotUserId(seat.userId)).length;
  const hasBots = botCount > 0;
  const humanCount = occupiedCount - botCount;
  const seatCommands = useFashionSeatCommands({ session, user });
  const { isSubmitting, submit } = useRoomCommandSubmission(getFashionRoomCommandFailureMessage);
  const [nowMs, setNowMs] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState(() =>
    hasCompletedFashionTutorial(user.id),
  );
  const [selectedGuessTarget, setSelectedGuessTarget] = useState<number | null>(null);
  const [contractPromise, setContractPromise] = useState<FashionContractPromise>('compensation');

  useEffect(() => {
    if (state.phase !== 'crossExamination' || state.interrogation === null) return undefined;
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const timer = setInterval(updateNow, 1000);
    return () => clearInterval(timer);
  }, [state.interrogation, state.phase]);

  const submitCommand = useCallback(
    (label: string, command: FashionPublicCommand): Promise<boolean> =>
      submit(label, () => session.dispatch(command, { controlledSeat: null, label })),
    [session, submit],
  );

  const round = FASHION_ROUND_BY_NUMBER[state.currentRound];
  const remainingMs =
    state.interrogation === null ? 0 : Math.max(0, state.interrogation.endsAt - nowMs);
  const hasConfirmedRole = mySeat !== null && state.roleConfirmedSeats.includes(mySeat);
  const hasVoted = mySeat !== null && state.votedSeats.includes(mySeat);
  const hasFinalVoted = mySeat !== null && state.finalVotedSeats.includes(mySeat);
  const currentCrossExamAward = state.crossExamAwards.find(
    (award) => award.round === state.currentRound,
  );
  const myTokens = mySeat === null ? null : (state.actionTokens[mySeat] ?? null);
  const mySpeakCount = mySeat === null ? 0 : (state.discussionSpeakCounts[mySeat] ?? 0);
  const hasCrossExamAwardVoted = mySeat !== null && state.crossExamAwardVotedSeats.includes(mySeat);
  const isCurrentCrossExamParticipant =
    mySeat !== null && state.interrogation?.participantSeats.includes(mySeat) === true;
  const myCrossExamTask =
    state.privateIdentity === null || !isCurrentCrossExamParticipant
      ? null
      : getCrossExamTask(state.currentRound, state.privateIdentity.roleId);

  const seatCards = useMemo(
    () =>
      Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => {
        const occupant = state.realSeats[seat];
        const isSelf = occupant?.userId === user.id;
        const isBot = occupant !== undefined && isFashionBotUserId(occupant.userId);
        const canTake = state.phase === 'lobby' && occupant === undefined && !isSubmitting;
        const label =
          occupant === undefined
            ? `${seat + 1}号 · 空位`
            : `${seat + 1}号 · ${occupant.profile.displayName}${isSelf ? '（你）' : isBot ? '（自动）' : ''}`;
        return (
          <View key={seat} style={styles.seatCell}>
            {canTake ? (
              <Button
                variant="secondary"
                size="md"
                onPress={() => void submit('入座', () => seatCommands.takeSeat(seat))}
              >
                {label}
              </Button>
            ) : (
              <Button variant={isSelf ? 'primary' : 'secondary'} size="md" disabled>
                {label}
              </Button>
            )}
          </View>
        );
      }),
    [isSubmitting, seatCommands, state.phase, state.realSeats, submit, user.id],
  );

  if (!tutorialCompleted) {
    return (
      <FashionTutorial
        topInset={insets.top}
        onBack={() => exitRoomFlow(navigation)}
        onComplete={() => {
          markFashionTutorialCompleted(user.id);
          setTutorialCompleted(true);
        }}
      />
    );
  }

  const renderIdentity = () => {
    if (state.privateIdentity === null) return null;
    const identity = state.privateIdentity;
    return (
      <View style={[styles.card, styles.privateCard]}>
        <Text style={styles.eyebrow}>仅你可见</Text>
        <Text style={styles.cardTitle}>{identity.roleName}</Text>
        <Text style={styles.label}>公开立场</Text>
        <Text style={styles.body}>{identity.publicStance}</Text>
        <Text style={styles.label}>隐藏秘密</Text>
        <Text style={styles.body}>{identity.secret}</Text>
        <Text style={styles.label}>独立胜利条件</Text>
        <Text style={styles.body}>{identity.victoryCondition}</Text>
        {myTokens !== null ? <Text style={styles.tokenText}>行动代币：{myTokens}</Text> : null}
      </View>
    );
  };

  const renderPhaseAction = () => {
    switch (state.phase) {
      case 'lobby':
        return (
          <View style={styles.actions}>
            {mySeat !== null ? (
              <Button
                variant="secondary"
                onPress={() => void submit('离座', seatCommands.leaveSeat)}
              >
                离开座位
              </Button>
            ) : null}
            {isHost ? (
              <>
                {mySeat !== null && occupiedCount < FASHION_PLAYER_COUNT ? (
                  <Button
                    variant="secondary"
                    onPress={() => void submit('补满测试玩家', seatCommands.fillBots)}
                    disabled={isSubmitting}
                  >
                    单人体验：补满测试玩家
                  </Button>
                ) : null}
                {mySeat === null && occupiedCount < FASHION_PLAYER_COUNT ? (
                  <Text style={styles.statusText}>
                    先选择一个座位，再可一键补满 6 个自动测试玩家。
                  </Text>
                ) : null}
                <Button
                  variant="primary"
                  size="lg"
                  onPress={() => void submitCommand('开始游戏', { type: 'fashion.game.start' })}
                  disabled={occupiedCount !== FASHION_PLAYER_COUNT || isSubmitting}
                >
                  开始第 1 轮
                </Button>
                {occupiedCount > 0 ? (
                  <Button
                    variant="ghost"
                    onPress={() => void submit('清空座位', seatCommands.clearSeats)}
                  >
                    清空座位
                  </Button>
                ) : null}
              </>
            ) : null}
          </View>
        );
      case 'roleReveal':
        return (
          <View style={styles.actions}>
            {mySeat !== null && !hasConfirmedRole ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() => void submitCommand('确认身份', { type: 'fashion.role.confirm' })}
                loading={isSubmitting}
              >
                我已阅读身份与秘密
              </Button>
            ) : (
              <Text style={styles.statusText}>已确认：{state.roleConfirmedSeats.length}/7</Text>
            )}
            {isHost ? (
              <Button
                variant="secondary"
                onPress={() => void submitCommand('公开事件', { type: 'fashion.event.reveal' })}
                disabled={state.roleConfirmedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting}
              >
                全员确认后公开本轮事件
              </Button>
            ) : null}
          </View>
        );
      case 'event':
        return (
          <View style={styles.actions}>
            <Text style={styles.statusText}>
              本轮共有两组交叉质询，每组 3 分钟，共 4 名玩家参与。
            </Text>
            {isHost ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() =>
                  void submitCommand('开始交叉质询', { type: 'fashion.crossExam.start' })
                }
                loading={isSubmitting}
              >
                开始第 1 组交叉质询
              </Button>
            ) : (
              <Text style={styles.statusText}>等待房主开始第 1 组交叉质询</Text>
            )}
          </View>
        );
      case 'crossExamination':
        return (
          <View style={styles.actions}>
            <Text style={styles.statusText}>
              第 {state.interrogation?.match ?? 1} / 2 组交叉质询
            </Text>
            <Text style={styles.timer}>{formatRemaining(remainingMs)}</Text>
            <Text style={styles.statusText}>
              {state.interrogation === null
                ? '质询状态同步中'
                : `${state.interrogation.attackerSeat + 1}号（攻击） vs ${state.interrogation.defenderSeat + 1}号（防守）`}
            </Text>
            {isCurrentCrossExamParticipant ? (
              <View style={[styles.card, styles.privateCard]}>
                <Text style={styles.eyebrow}>你的质询任务</Text>
                <Text style={styles.body}>
                  {myCrossExamTask ??
                    `你被指定为代理出战。按当前${state.interrogation?.attackerSeat === mySeat ? '攻击方' : '防守方'}位置回应，并使用证据、自己的秘密或合理逻辑完成攻防。`}
                </Text>
                <Text style={styles.statusText}>本组参与会消耗 1 枚行动代币。</Text>
                {mySeat !== null && state.revealedSecrets[mySeat] === undefined ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      void submitCommand('公开自己的隐藏秘密', {
                        type: 'fashion.secret.revealSelf',
                      })
                    }
                    disabled={isSubmitting}
                  >
                    公开我的隐藏秘密作为攻防武器
                  </Button>
                ) : (
                  <Text style={styles.statusText}>你的隐藏秘密已经公开。</Text>
                )}
              </View>
            ) : (
              <Text style={styles.statusText}>
                你本组作为旁听陪审团，记录双方论点，稍后参与最佳攻防评选。
              </Text>
            )}
            {isHost ? (
              <Button
                variant="primary"
                onPress={() =>
                  void submitCommand('结束交叉质询', { type: 'fashion.crossExam.finish' })
                }
                disabled={(remainingMs > 0 && !hasBots) || isSubmitting}
              >
                {state.interrogation?.match === 1
                  ? hasBots && remainingMs > 0
                    ? '体验模式：立即进入第 2 组'
                    : '时间结束，进入第 2 组'
                  : hasBots && remainingMs > 0
                    ? '体验模式：立即进入讨论与评选'
                    : '两组完成，进入讨论与评选'}
              </Button>
            ) : null}
          </View>
        );
      case 'discussion':
        return (
          <View style={styles.actions}>
            <Text style={styles.label}>最佳攻防者评选</Text>
            <Text style={styles.statusText}>
              全体 7 名玩家各投 1 票，只能选择本轮两组质询的实际参与者。已提交{' '}
              {state.crossExamAwardVotedSeats.length}/7。
            </Text>
            {mySeat !== null && !hasCrossExamAwardVoted ? (
              <View style={styles.choiceGrid}>
                {state.crossExamParticipantSeats.map((seat) => (
                  <View key={seat} style={styles.choiceCell}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() =>
                        void submitCommand('投最佳攻防者', {
                          type: 'fashion.crossExam.award',
                          seat,
                        })
                      }
                      disabled={isSubmitting}
                    >
                      {seat + 1}号
                    </Button>
                  </View>
                ))}
              </View>
            ) : hasCrossExamAwardVoted ? (
              <Text style={styles.statusText}>你的最佳攻防者票已提交。</Text>
            ) : null}
            <Text style={styles.label}>公开讨论</Text>
            <Text style={styles.statusText}>
              主动发言会消耗 1 枚行动代币。你本轮已主动发言 {mySpeakCount} 次。
            </Text>
            {mySeat !== null ? (
              <Button
                variant="secondary"
                onPress={() => void submitCommand('主动发言', { type: 'fashion.discussion.speak' })}
                disabled={(myTokens ?? 0) < 1 || isSubmitting}
              >
                消耗 1 枚代币主动发言
              </Button>
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                onPress={() =>
                  void submitCommand('结束讨论', { type: 'fashion.discussion.finish' })
                }
                disabled={
                  state.crossExamAwardVotedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting
                }
              >
                全员完成评选后进入调查投票
              </Button>
            ) : null}
          </View>
        );
      case 'vote':
        return (
          <View style={styles.actions}>
            {currentCrossExamAward !== undefined ? (
              <Text style={styles.statusText}>
                本轮最佳攻防者：{currentCrossExamAward.seat + 1}号
              </Text>
            ) : (
              <Text style={styles.statusText}>最佳攻防评选出现并列，本轮无人获得奖励。</Text>
            )}
            {mySeat !== null && !state.hasGuessedThisRound && (myTokens ?? 0) > 0 ? (
              <>
                <Text style={styles.label}>猜身份（可选，消耗 1 枚代币）</Text>
                <Text style={styles.statusText}>
                  先选一名其他玩家，再猜他的真实角色。猜对会公开该玩家隐藏秘密；猜错则你下轮不能参加交叉质询。
                </Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) =>
                    seat === mySeat ? null : (
                      <View key={seat} style={styles.choiceCell}>
                        <Button
                          variant={selectedGuessTarget === seat ? 'primary' : 'secondary'}
                          size="sm"
                          onPress={() => setSelectedGuessTarget(seat)}
                        >
                          {seat + 1}号
                        </Button>
                      </View>
                    ),
                  )}
                </View>
                {selectedGuessTarget !== null ? (
                  <View style={styles.choiceGrid}>
                    {FASHION_ROLE_IDS.filter(
                      (roleId) => roleId !== state.privateIdentity?.roleId,
                    ).map((roleId) => (
                      <View key={roleId} style={styles.choiceCell}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            void submitCommand('猜身份', {
                              type: 'fashion.identityGuess.cast',
                              targetSeat: selectedGuessTarget,
                              guessedRoleId: roleId,
                            }).then((ok) => {
                              if (ok) setSelectedGuessTarget(null);
                            });
                          }}
                          disabled={isSubmitting}
                        >
                          {FASHION_ROLE_BY_ID[roleId].name}
                        </Button>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : state.hasGuessedThisRound ? (
              <Text style={styles.statusText}>你本轮已经使用过猜身份。</Text>
            ) : null}
            <Text style={styles.label}>调查表决</Text>
            <Text style={styles.statusText}>已投票：{state.votedSeats.length}/7</Text>
            {mySeat !== null && !hasVoted ? (
              <View style={styles.voteRow}>
                <Button
                  variant="primary"
                  onPress={() =>
                    void submitCommand('赞成调查', { type: 'fashion.vote.cast', vote: 'approve' })
                  }
                >
                  赞成调查
                </Button>
                <Button
                  variant="secondary"
                  onPress={() =>
                    void submitCommand('反对调查', { type: 'fashion.vote.cast', vote: 'reject' })
                  }
                >
                  反对调查
                </Button>
              </View>
            ) : hasVoted ? (
              <Text style={styles.statusText}>你的投票已提交，具体选择不会在投票结束前公开。</Text>
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                onPress={() => void submitCommand('结算投票', { type: 'fashion.vote.finish' })}
                disabled={state.votedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting}
              >
                全员投票后结算 {round.evidenceId}
              </Button>
            ) : null}
          </View>
        );
      case 'roundTransition': {
        const isPublic = state.publicEvidence.includes(round.evidenceId);
        const isWorker = state.privateIdentity?.roleId === 'factoryWorker';
        const proposedToMe = state.myContracts.filter(
          (contract) => contract.buyerSeat === mySeat && contract.status === 'proposed',
        );
        return (
          <View style={styles.actions}>
            <View style={[styles.card, isPublic ? styles.resultPublic : styles.resultDestroyed]}>
              <Text style={styles.cardTitle}>
                第 {state.currentRound} 轮 · {isPublic ? '调查通过' : '调查失败'}
              </Text>
              <Text style={styles.body}>
                {isPublic
                  ? `${round.evidenceId}「${round.evidenceTitle}」已进入公共证据区。`
                  : `${round.evidenceId}「${round.evidenceTitle}」已永久销毁。`}
              </Text>
            </View>
            <Text style={styles.label}>自由交易时间</Text>
            <Text style={styles.statusText}>
              主动提出交易邀请者消耗 1 枚行动代币；回应与签约不额外消耗代币。
            </Text>
            {isWorker && mySeat !== null ? (
              <>
                <Text style={styles.statusText}>
                  你是工厂工人，可选择买家与契约承诺。买家最终获胜且契约已接受时，你的契约胜利条件生效。
                </Text>
                <View style={styles.choiceGrid}>
                  {(Object.keys(CONTRACT_PROMISE_LABELS) as FashionContractPromise[]).map(
                    (promise) => (
                      <View key={promise} style={styles.choiceCell}>
                        <Button
                          variant={contractPromise === promise ? 'primary' : 'secondary'}
                          size="sm"
                          onPress={() => setContractPromise(promise)}
                        >
                          {CONTRACT_PROMISE_LABELS[promise]}
                        </Button>
                      </View>
                    ),
                  )}
                </View>
                <Text style={styles.statusText}>选择买家：</Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, buyerSeat) =>
                    buyerSeat === mySeat ? null : (
                      <View key={buyerSeat} style={styles.choiceCell}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() =>
                            void submitCommand('提出契约', {
                              type: 'fashion.contract.propose',
                              contractId: `r${state.currentRound}-s${mySeat}-b${buyerSeat}-${contractPromise}`,
                              buyerSeat,
                              promise: contractPromise,
                            })
                          }
                          disabled={(myTokens ?? 0) < 1 || isSubmitting}
                        >
                          {buyerSeat + 1}号
                        </Button>
                      </View>
                    ),
                  )}
                </View>
              </>
            ) : null}
            {proposedToMe.map((contract) => (
              <View key={contract.id} style={[styles.card, styles.privateCard]}>
                <Text style={styles.eyebrow}>仅你可见 · 契约邀请</Text>
                <Text style={styles.body}>
                  {contract.sellerSeat + 1}号向你提出契约：
                  {CONTRACT_PROMISE_LABELS[contract.promise]}
                </Text>
                <Button
                  variant="primary"
                  size="sm"
                  onPress={() =>
                    void submitCommand('接受契约', {
                      type: 'fashion.contract.accept',
                      contractId: contract.id,
                    })
                  }
                  disabled={isSubmitting}
                >
                  接受并签署契约
                </Button>
              </View>
            ))}
            {state.myContracts
              .filter((contract) => contract.status !== 'proposed')
              .map((contract) => (
                <Text key={contract.id} style={styles.statusText}>
                  契约：{contract.sellerSeat + 1}号 ↔ {contract.buyerSeat + 1}号 ·{' '}
                  {CONTRACT_PROMISE_LABELS[contract.promise]} ·{' '}
                  {contract.status === 'fulfilled' ? '已履行' : '已签署'}
                </Text>
              ))}
            {isHost ? (
              state.currentRound < 4 ? (
                <Button
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    void submitCommand('进入下一轮', { type: 'fashion.round.advance' })
                  }
                  loading={isSubmitting}
                >
                  进入第 {state.currentRound + 1} 轮
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onPress={() =>
                    void submitCommand('开始最终听证', { type: 'fashion.hearing.start' })
                  }
                  loading={isSubmitting}
                >
                  开始最终听证
                </Button>
              )
            ) : (
              <Text style={styles.statusText}>等待房主推进流程</Text>
            )}
          </View>
        );
      }
      case 'hearing':
        return (
          <View style={styles.actions}>
            <Text style={styles.label}>结案陈词</Text>
            <Text style={styles.statusText}>
              每人最多 1 分钟。陈词时请至少引用 1 张公共证据；公开证据达到 2
              张以上，且最终唯一被指认者确为反派，才会定罪。
            </Text>
            <Text style={styles.statusText}>已提交最终指控：{state.finalVotedSeats.length}/7</Text>
            {mySeat !== null && !hasFinalVoted ? (
              <>
                <Text style={styles.statusText}>选择你认为应被最终定罪的座位：</Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => (
                    <View key={seat} style={styles.choiceCell}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          void submitCommand('提交最终指控', {
                            type: 'fashion.hearing.vote',
                            targetSeat: seat,
                          })
                        }
                        disabled={isSubmitting}
                      >
                        {seat + 1}号
                      </Button>
                    </View>
                  ))}
                </View>
              </>
            ) : hasFinalVoted ? (
              <Text style={styles.statusText}>你的最终指控已提交。</Text>
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() =>
                  void submitCommand('结算最终听证', { type: 'fashion.hearing.finish' })
                }
                disabled={state.finalVotedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting}
              >
                全员指控后结算胜负
              </Button>
            ) : null}
          </View>
        );
      case 'ended': {
        const winnerLabels = state.winners.map((seat) => {
          const occupant = state.realSeats[seat];
          return occupant === undefined
            ? `${seat + 1}号`
            : `${seat + 1}号 ${occupant.profile.displayName}`;
        });
        const didWin = mySeat !== null && state.winners.includes(mySeat);
        return (
          <View style={[styles.card, didWin ? styles.resultPublic : styles.resultDestroyed]}>
            <Text style={styles.cardTitle}>{didWin ? '你达成了胜利条件' : '本局结束'}</Text>
            <Text style={styles.body}>
              胜者：{winnerLabels.length > 0 ? winnerLabels.join('、') : '无'}
            </Text>
            <Text style={styles.statusText}>4 轮调查与最终听证已全部完成。</Text>
          </View>
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="时尚追凶"
        onBack={() => exitRoomFlow(navigation)}
        topInset={insets.top}
        headerRight={
          <Button
            variant="ghost"
            onPress={() =>
              navigation.navigate('GameGuide', {
                gameType: 'fashion-shadow',
                roomCode: room.roomCode,
              })
            }
          >
            规则
          </Button>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            房间 {room.roomCode} · 第 {state.currentRound} 轮
          </Text>
          <Text style={styles.heroTitle}>{PHASE_LABELS[state.phase]}</Text>
          <Text style={styles.body}>
            入座 {occupiedCount}/7 · 真人 {humanCount} · 测试玩家 {botCount}
          </Text>
        </View>

        {state.phase === 'lobby' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>座位</Text>
            <View style={styles.seatGrid}>{seatCards}</View>
          </View>
        ) : null}

        {renderIdentity()}

        {state.currentEvent !== null ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {round.location} · {round.esg}
            </Text>
            <Text style={styles.cardTitle}>
              {round.eventId} · {round.eventTitle}
            </Text>
            <Text style={styles.body}>{round.eventDescription}</Text>
            {state.voteQuestion !== null ? (
              <>
                <Text style={styles.label}>本轮调查议题</Text>
                <Text style={styles.body}>{state.voteQuestion}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>当前操作</Text>
          {renderPhaseAction()}
        </View>

        {Object.keys(state.revealedSecrets).length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>已公开秘密</Text>
            {Object.entries(state.revealedSecrets).map(([seat, secretId]) => (
              <Text key={seat} style={styles.body}>
                {Number(seat) + 1}号：{getSecretText(secretId)}
              </Text>
            ))}
          </View>
        ) : null}

        {state.publicEvidence.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>公共证据区</Text>
            {state.publicEvidence.map((evidenceId) => (
              <Text key={evidenceId} style={styles.body}>
                {evidenceId} · {getEvidenceTitle(evidenceId)}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  hero: { gap: spacing.tight },
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.large,
    gap: spacing.small,
  },
  privateCard: { borderColor: colors.primary },
  resultPublic: { borderColor: colors.success },
  resultDestroyed: { borderColor: colors.error },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  label: {
    marginTop: spacing.small,
    color: colors.text,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  tokenText: {
    marginTop: spacing.small,
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: typography.weights.bold,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  timer: {
    color: colors.text,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  seatCell: { width: '48%' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  choiceCell: { width: '31%' },
  actions: { gap: spacing.small },
  voteRow: { gap: spacing.small },
});

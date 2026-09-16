// Fashion Shadow first-round room UI over the shared room session and redacted server state.

import {
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_BY_ID,
  FASHION_ROLE_IDS,
  FASHION_ROUND_ACTION_TOKEN_RECOVERY,
  FASHION_ROUND_BY_NUMBER,
  type FashionContractPromise,
  type FashionPublicCommand,
  type FashionPublicState,
  type FashionRoleId,
  isFashionBotUserId,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthContext } from '@/contexts/AuthContext';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import { useFashionAudioFeedback } from '@/games/fashion-shadow/audio/useFashionAudioFeedback';
import { FashionBackdrop } from '@/games/fashion-shadow/components/FashionBackdrop';
import { FashionButton as Button } from '@/games/fashion-shadow/components/FashionButton';
import { FashionContractCard } from '@/games/fashion-shadow/components/FashionContractCard';
import { FashionCrossExamAwardBanner } from '@/games/fashion-shadow/components/FashionCrossExamAwardBanner';
import { FashionCrossExamTimedControls } from '@/games/fashion-shadow/components/FashionCrossExamTimedControls';
import { FashionCrossExamTranscript } from '@/games/fashion-shadow/components/FashionCrossExamTranscript';
import { FashionDiscussionFeed } from '@/games/fashion-shadow/components/FashionDiscussionFeed';
import { FashionEventCard } from '@/games/fashion-shadow/components/FashionEventCard';
import { FashionEvidenceCard } from '@/games/fashion-shadow/components/FashionEvidenceCard';
import { FashionHeader } from '@/games/fashion-shadow/components/FashionHeader';
import { FashionHearingDossier } from '@/games/fashion-shadow/components/FashionHearingDossier';
import { FashionIdentityCard } from '@/games/fashion-shadow/components/FashionIdentityCard';
import { FashionInvestigationBoard } from '@/games/fashion-shadow/components/FashionInvestigationBoard';
import { FashionPanel } from '@/games/fashion-shadow/components/FashionPanel';
import { FashionPhaseRail } from '@/games/fashion-shadow/components/FashionPhaseRail';
import { FashionPlayerStrip } from '@/games/fashion-shadow/components/FashionPlayerStrip';
import { FashionSettlementBoard } from '@/games/fashion-shadow/components/FashionSettlementBoard';
import { FashionVoteProgress } from '@/games/fashion-shadow/components/FashionVoteProgress';
import { useFashionCompactLayout } from '@/games/fashion-shadow/components/useFashionCompactLayout';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';
import { FashionTutorial } from '@/games/fashion-shadow/tutorial/FashionTutorial';
import {
  hasCompletedFashionTutorial,
  markFashionTutorialCompleted,
} from '@/games/fashion-shadow/tutorial/tutorialProgress';
import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';
import { triggerHaptic } from '@/utils/haptics';

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

function getEvidenceRound(evidenceId: FashionPublicState['publicEvidence'][number]) {
  for (const roundNumber of [1, 2, 3, 4] as const) {
    const round = FASHION_ROUND_BY_NUMBER[roundNumber];
    if (round.evidenceId === evidenceId) return round;
  }
  throw new Error(`[FAIL-FAST] Unknown Fashion Shadow evidence ${evidenceId}`);
}

const CONTRACT_PROMISES: readonly FashionContractPromise[] = [
  'compensation',
  'protection',
  'legalImmunity',
];

const CONTRACT_PROMISE_LABELS: Readonly<Record<FashionContractPromise, string>> = {
  compensation: '经济补偿',
  protection: '人身保护',
  legalImmunity: '法律豁免',
};

function getSecretText(secretId: FashionPublicState['revealedSecrets'][number]): string {
  const role = Object.values(FASHION_ROLE_BY_ID).find((entry) => entry.secretId === secretId);
  return role?.secret ?? secretId;
}

function getPlayerLabel(state: FashionPublicState, seat: number): string {
  const occupant = state.realSeats[seat];
  return occupant === undefined
    ? `${seat + 1}号`
    : `${seat + 1}号 · ${occupant.profile.displayName}`;
}

function getDiscussionPrompt(round: 1 | 2 | 3 | 4, roleId: FashionRoleId): string {
  const caseFile = FASHION_ROUND_BY_NUMBER[round];
  switch (roleId) {
    case 'journalist':
      return `逼问谁在${caseFile.location}事件里最怕文件被公开。优先抓前后说法矛盾，不要只复述证据。`;
    case 'governmentOfficial':
      return `把讨论拉回“谁应承担监管与决策责任”。你需要控制风险，同时避免自己的旧稽查问题成为焦点。`;
    case 'consumerRepresentative':
      return `要求其他人给出可执行的赔偿与整改承诺，并观察谁一直回避消费者损失。`;
    case 'factoryWorker':
      return `利用你掌握的一手资料制造谈判筹码。不要过早交出全部信息，为轮次结算后的契约交易留空间。`;
    case 'brandExecutive':
      return `切割公司制度与个人决策，把责任链具体化到采购、供应商或执行环节，同时回应品牌整改责任。`;
    case 'villainProcurementDirector':
      return `制造合理替代解释，把“异常”拆成供应、报关、工厂或顾问执行问题，避免讨论形成唯一责任链。`;
    case 'supplierOwner':
      return `强调订单与付款链能够证明谁发出要求，但避免让讨论转向你自己的供货履约历史。`;
  }
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
  const compactLayout = useFashionCompactLayout();
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
  useFashionAudioFeedback({ state, isHost });
  const occupiedSeats = Object.values(state.realSeats).filter((seat) => seat !== undefined);
  const occupiedCount = occupiedSeats.length;
  const botCount = occupiedSeats.filter((seat) => isFashionBotUserId(seat.userId)).length;
  const hasBots = botCount > 0;
  const humanCount = occupiedCount - botCount;
  const seatCommands = useFashionSeatCommands({ session, user });
  const { isSubmitting, submit } = useRoomCommandSubmission(getFashionRoomCommandFailureMessage);
  const [tutorialCompleted, setTutorialCompleted] = useState(() =>
    hasCompletedFashionTutorial(user.id),
  );
  const [selectedGuessTarget, setSelectedGuessTarget] = useState<number | null>(null);
  const [contractPromise, setContractPromise] = useState<FashionContractPromise>('compensation');
  const previousPhaseRef = useRef(state.phase);

  useEffect(() => {
    if (previousPhaseRef.current === state.phase) return;
    previousPhaseRef.current = state.phase;
    switch (state.phase) {
      case 'roleReveal':
      case 'event':
      case 'discussion':
        void triggerHaptic('selection');
        break;
      case 'crossExamination':
        void triggerHaptic('medium');
        break;
      case 'vote':
        void triggerHaptic('warning');
        break;
      case 'roundTransition':
        void triggerHaptic('success');
        break;
      case 'hearing':
        void triggerHaptic('heavy');
        break;
      case 'ended':
        void triggerHaptic(
          mySeat !== null && state.winners.includes(mySeat) ? 'success' : 'warning',
        );
        break;
      case 'lobby':
        break;
    }
  }, [mySeat, state.phase, state.winners]);

  const submitCommand = useCallback(
    (label: string, command: FashionPublicCommand): Promise<boolean> =>
      submit(label, () => session.dispatch(command, { controlledSeat: null, label })),
    [session, submit],
  );

  const round = FASHION_ROUND_BY_NUMBER[state.currentRound];
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
          <View key={seat} style={[styles.seatCell, compactLayout ? styles.fullWidthCell : null]}>
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
    [compactLayout, isSubmitting, seatCommands, state.phase, state.realSeats, submit, user.id],
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
                    测试模式：用自动玩家补满空位
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
          <FashionCrossExamTimedControls
            state={state}
            mySeat={mySeat}
            isHost={isHost}
            hasBots={hasBots}
            isSubmitting={isSubmitting}
            onFinish={() =>
              void submitCommand('结束交叉质询', { type: 'fashion.crossExam.finish' })
            }
            onSend={(message, evidenceId) =>
              evidenceId === undefined
                ? submitCommand('记录交叉质询论点', {
                    type: 'fashion.crossExam.statement',
                    message,
                  })
                : submitCommand('记录交叉质询论点', {
                    type: 'fashion.crossExam.statement',
                    message,
                    evidenceId,
                  })
            }
          >
            <Text style={styles.statusText}>
              {state.interrogation === null
                ? '质询状态同步中'
                : `${getPlayerLabel(state, state.interrogation.attackerSeat)}（攻击） vs ${getPlayerLabel(state, state.interrogation.defenderSeat)}（防守）`}
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
          </FashionCrossExamTimedControls>
        );
      case 'discussion':
        return (
          <View style={styles.actions}>
            <Text style={styles.label}>最佳攻防者评选</Text>
            <Text style={styles.statusText}>
              全体 7 名玩家各投 1 票，只能选择本轮两组质询的实际参与者。
            </Text>
            <FashionVoteProgress
              submitted={state.crossExamAwardVotedSeats.length}
              label="最佳攻防者评选"
            />
            {mySeat !== null && !hasCrossExamAwardVoted ? (
              <View style={styles.choiceGrid}>
                {state.crossExamParticipantSeats.map((seat) => (
                  <View
                    key={seat}
                    style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                  >
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
                      {getPlayerLabel(state, seat)}
                    </Button>
                  </View>
                ))}
              </View>
            ) : hasCrossExamAwardVoted ? (
              <Text style={styles.statusText}>你的最佳攻防者票已提交。</Text>
            ) : null}
            <Text style={styles.label}>公开讨论</Text>
            {state.privateIdentity !== null ? (
              <View style={styles.tacticCard}>
                <Text style={styles.tacticLabel}>你的本轮讨论目标</Text>
                <Text style={styles.body}>
                  {getDiscussionPrompt(state.currentRound, state.privateIdentity.roleId)}
                </Text>
              </View>
            ) : null}
            <FashionDiscussionFeed
              state={state}
              mySeat={mySeat}
              myTokens={myTokens}
              mySpeakCount={mySpeakCount}
              isSubmitting={isSubmitting}
              onSend={(message) =>
                submitCommand('发布公开论点', { type: 'fashion.discussion.speak', message })
              }
            />
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
            <FashionCrossExamAwardBanner
              seat={currentCrossExamAward?.seat ?? null}
              displayName={
                currentCrossExamAward === undefined
                  ? null
                  : (state.realSeats[currentCrossExamAward.seat]?.profile.displayName ?? null)
              }
            />
            {mySeat !== null && !state.hasGuessedThisRound && (myTokens ?? 0) > 0 ? (
              <>
                <Text style={styles.label}>猜身份（可选，消耗 1 枚代币）</Text>
                <Text style={styles.statusText}>
                  先选一名其他玩家，再猜他的真实角色。猜对会公开该玩家隐藏秘密；猜错则你下轮不能参加交叉质询。
                </Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) =>
                    seat === mySeat ? null : (
                      <View
                        key={seat}
                        style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                      >
                        <Button
                          variant={selectedGuessTarget === seat ? 'primary' : 'secondary'}
                          size="sm"
                          onPress={() => setSelectedGuessTarget(seat)}
                          accessibilityState={{ selected: selectedGuessTarget === seat }}
                          accessibilityHint="选择此玩家后，再选择要猜测的真实角色"
                        >
                          {getPlayerLabel(state, seat)}
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
                      <View
                        key={roleId}
                        style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                      >
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
                          accessibilityHint="提交身份猜测，成功或失败都会消耗本轮猜身份机会"
                        >
                          {FASHION_ROLE_BY_ID[roleId].name}
                        </Button>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : state.hasGuessedThisRound ? (
              <View style={styles.actions}>
                <Text style={styles.statusText}>你本轮已经使用过猜身份。</Text>
                {state.myIdentityGuessResult !== null ? (
                  <Text style={styles.statusText}>
                    {state.myIdentityGuessResult.success
                      ? `猜对：${getPlayerLabel(state, state.myIdentityGuessResult.targetSeat)}确实是${FASHION_ROLE_BY_ID[state.myIdentityGuessResult.guessedRoleId].name}，其隐藏秘密已公开。`
                      : `猜错：${getPlayerLabel(state, state.myIdentityGuessResult.targetSeat)}不是${FASHION_ROLE_BY_ID[state.myIdentityGuessResult.guessedRoleId].name}。${state.myIdentityGuessResult.blockedNextRound ? '你下一轮不能参加交叉质询。' : '这是最后一轮，不再产生后续质询处罚。'}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.label}>调查表决</Text>
            <FashionVoteProgress submitted={state.votedSeats.length} label="调查票提交进度" />
            {mySeat !== null && !hasVoted ? (
              <View style={styles.voteRow}>
                <Button
                  variant="primary"
                  onPress={() =>
                    void submitCommand('赞成调查', { type: 'fashion.vote.cast', vote: 'approve' })
                  }
                  accessibilityHint="提交后本轮调查票不可修改"
                >
                  赞成调查
                </Button>
                <Button
                  variant="secondary"
                  onPress={() =>
                    void submitCommand('反对调查', { type: 'fashion.vote.cast', vote: 'reject' })
                  }
                  accessibilityHint="提交后本轮调查票不可修改"
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
              主动提出交易邀请者消耗 1
              枚行动代币；回应与签约不额外消耗代币。进入下一轮时每名玩家恢复{' '}
              {FASHION_ROUND_ACTION_TOKEN_RECOVERY} 枚行动代币，最多恢复到开局上限。
            </Text>
            {isWorker && mySeat !== null ? (
              <>
                <Text style={styles.statusText}>
                  你是工厂工人，可选择买家与契约承诺。契约签署后仍需由你确认履行；买家最终获胜且契约已履行时，你的契约胜利条件生效。
                </Text>
                <View style={styles.choiceGrid}>
                  {CONTRACT_PROMISES.map((promise) => (
                    <View
                      key={promise}
                      style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                    >
                      <Button
                        variant={contractPromise === promise ? 'primary' : 'secondary'}
                        size="sm"
                        onPress={() => setContractPromise(promise)}
                        accessibilityState={{ selected: contractPromise === promise }}
                        accessibilityHint="选择这项作为下一份秘密契约的承诺"
                      >
                        {CONTRACT_PROMISE_LABELS[promise]}
                      </Button>
                    </View>
                  ))}
                </View>
                <Text style={styles.statusText}>选择买家：</Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, buyerSeat) =>
                    buyerSeat === mySeat ? null : (
                      <View
                        key={buyerSeat}
                        style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                      >
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
                          {getPlayerLabel(state, buyerSeat)}
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
                  {getPlayerLabel(state, contract.sellerSeat)}向你提出契约：
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
                <FashionContractCard
                  key={contract.id}
                  contract={contract}
                  sellerLabel={getPlayerLabel(state, contract.sellerSeat)}
                  buyerLabel={getPlayerLabel(state, contract.buyerSeat)}
                  promiseLabel={CONTRACT_PROMISE_LABELS[contract.promise]}
                  canFulfill={contract.sellerSeat === mySeat && contract.status === 'accepted'}
                  isSubmitting={isSubmitting}
                  onFulfill={() =>
                    void submitCommand('履行契约', {
                      type: 'fashion.contract.fulfill',
                      contractId: contract.id,
                    })
                  }
                />
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
            {hasBots ? (
              <Text style={styles.statusText}>
                测试模式：自动玩家会把最终指控分散到测试席位；真人票负责形成最终差异。
              </Text>
            ) : null}
            <FashionHearingDossier state={state} />
            <FashionVoteProgress
              submitted={state.finalVotedSeats.length}
              label="最终指控提交进度"
              tone="pink"
            />
            {mySeat !== null && !hasFinalVoted ? (
              <>
                <Text style={styles.statusText}>选择你认为应被最终定罪的座位：</Text>
                <View style={styles.choiceGrid}>
                  {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => (
                    <View
                      key={seat}
                      style={[styles.choiceCell, compactLayout ? styles.compactChoiceCell : null]}
                    >
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
                        accessibilityHint="提交后最终指控不可修改"
                      >
                        {getPlayerLabel(state, seat)}
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
            <Text style={styles.eyebrow}>CASE CLOSED / 案件封存</Text>
            <Text style={styles.cardTitle}>
              {didWin ? '你达成了个人胜利条件' : '你的个人目标未完成'}
            </Text>
            <Text style={styles.body}>
              胜者：{winnerLabels.length > 0 ? winnerLabels.join('、') : '无'}
            </Text>
            <View
              style={[styles.resultMetrics, compactLayout ? styles.resultMetricsCompact : null]}
            >
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>{state.publicEvidence.length}</Text>
                <Text style={styles.metricLabel}>公开证据</Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>{state.destroyedEvidence.length}</Text>
                <Text style={styles.metricLabel}>销毁证据</Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>{Object.keys(state.revealedSecrets).length}</Text>
                <Text style={styles.metricLabel}>公开秘密</Text>
              </View>
            </View>
            {state.privateIdentity !== null ? (
              <>
                <Text style={styles.label}>你的胜利条件</Text>
                <Text style={styles.body}>{state.privateIdentity.victoryCondition}</Text>
              </>
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() => void submitCommand('重新开案', { type: 'fashion.game.restart' })}
                loading={isSubmitting}
              >
                原房间重新开案
              </Button>
            ) : (
              <Text style={styles.statusText}>房主可以保留当前 7 人座位并重新随机身份开案。</Text>
            )}
            <Button variant="secondary" onPress={() => exitRoomFlow(navigation)}>
              返回游戏大厅
            </Button>
          </View>
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FashionBackdrop />
      <FashionHeader
        title="时尚追凶"
        onBack={() => exitRoomFlow(navigation)}
        topInset={insets.top}
        right={
          <Button
            variant="ghost"
            size="sm"
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CASE ROOM · {room.roomCode}</Text>
          <Text style={styles.heroTitle}>{PHASE_LABELS[state.phase]}</Text>
          <Text style={styles.body}>
            第 {state.currentRound} 轮 · 入座 {occupiedCount}/7 · 真人 {humanCount} · 测试玩家{' '}
            {botCount}
          </Text>
        </View>

        <FashionPhaseRail currentRound={state.currentRound} phase={state.phase} />

        {state.phase === 'lobby' ? (
          <FashionPanel tone="cyan">
            <Text style={styles.cardTitle}>调查席位</Text>
            <Text style={styles.statusText}>7 人全部入座后才能封锁案件现场并随机分配身份。</Text>
            <View style={styles.seatGrid}>{seatCards}</View>
          </FashionPanel>
        ) : (
          <FashionPlayerStrip state={state} mySeat={mySeat} />
        )}

        {state.privateIdentity !== null ? (
          <FashionIdentityCard identity={state.privateIdentity} actionTokens={myTokens} />
        ) : null}

        {state.currentEvent !== null ? (
          <FashionEventCard roundNumber={state.currentRound} voteQuestion={state.voteQuestion} />
        ) : null}

        <FashionPanel tone={state.phase === 'hearing' ? 'pink' : 'neutral'}>
          <Text style={styles.eyebrow}>LIVE ACTION</Text>
          <Text style={styles.cardTitle}>当前操作</Text>
          {renderPhaseAction()}
        </FashionPanel>

        {state.phase === 'ended' ? <FashionSettlementBoard state={state} mySeat={mySeat} /> : null}

        {state.phase !== 'crossExamination' && state.crossExamStatements.length > 0 ? (
          <FashionPanel tone="neutral">
            <FashionCrossExamTranscript state={state} mySeat={mySeat} mode="archive" />
          </FashionPanel>
        ) : null}

        {state.phase !== 'discussion' && state.discussionMessages.length > 0 ? (
          <FashionPanel tone="neutral">
            <FashionDiscussionFeed state={state} mySeat={mySeat} mode="archive" />
          </FashionPanel>
        ) : null}

        {state.phase !== 'lobby' && state.phase !== 'roleReveal' && state.phase !== 'event' ? (
          <FashionPanel tone="neutral">
            <FashionInvestigationBoard state={state} mySeat={mySeat} />
          </FashionPanel>
        ) : null}

        {Object.keys(state.revealedSecrets).length > 0 ? (
          <FashionPanel tone="pink">
            <Text style={styles.cardTitle}>已公开秘密</Text>
            {Object.entries(state.revealedSecrets).map(([seat, secretId]) => (
              <Text key={seat} style={styles.body}>
                {getPlayerLabel(state, Number(seat))}：{getSecretText(secretId)}
              </Text>
            ))}
          </FashionPanel>
        ) : null}

        {state.publicEvidence.length > 0 || state.destroyedEvidence.length > 0 ? (
          <FashionPanel tone="cyan">
            <Text style={styles.eyebrow}>EVIDENCE ARCHIVE</Text>
            <Text style={styles.cardTitle}>案件证据库</Text>
            <View style={styles.evidenceGrid}>
              {state.publicEvidence.map((evidenceId) => {
                const evidenceRound = getEvidenceRound(evidenceId);
                return (
                  <FashionEvidenceCard
                    key={evidenceId}
                    evidenceId={evidenceId}
                    title={evidenceRound.evidenceTitle}
                    location={evidenceRound.location}
                    summary={evidenceRound.eventDescription}
                    implications={evidenceRound.implicatedRoles.map(
                      (roleId) => FASHION_ROLE_BY_ID[roleId].name,
                    )}
                    status="public"
                  />
                );
              })}
              {state.destroyedEvidence.map((evidenceId) => {
                const evidenceRound = getEvidenceRound(evidenceId);
                return (
                  <FashionEvidenceCard
                    key={evidenceId}
                    evidenceId={evidenceId}
                    title={evidenceRound.evidenceTitle}
                    location={evidenceRound.location}
                    summary={evidenceRound.eventDescription}
                    implications={[]}
                    status="destroyed"
                  />
                );
              })}
            </View>
          </FashionPanel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: fashionShadowColors.background },
  content: { padding: spacing.screenH, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  hero: {
    gap: spacing.tight,
    backgroundColor: fashionShadowColors.surfaceMuted,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyanSoft,
    borderRadius: borderRadius.large,
    padding: spacing.large,
  },
  heroTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  eyebrow: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: fashionShadowColors.surfaceMuted,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    padding: spacing.large,
    gap: spacing.small,
  },
  privateCard: { borderColor: fashionShadowColors.neonPink },
  resultPublic: { borderColor: fashionShadowColors.success },
  resultDestroyed: { borderColor: fashionShadowColors.danger },
  cardTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  label: {
    marginTop: spacing.small,
    color: fashionShadowColors.text,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  statusText: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  seatCell: { width: '48%' },
  fullWidthCell: { width: '100%' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  choiceCell: { width: '31%' },
  compactChoiceCell: { width: '48%' },
  tacticCard: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPinkSoft,
    backgroundColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.medium,
    gap: spacing.small,
  },
  tacticLabel: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  resultMetrics: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  resultMetricsCompact: { flexDirection: 'column' },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceRaised,
    padding: spacing.small,
    gap: spacing.micro,
  },
  metricValue: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  metricLabel: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
  actions: { gap: spacing.small },
  voteRow: { gap: spacing.small },
});

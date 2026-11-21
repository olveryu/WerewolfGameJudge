import type {
  SecrethitlerEndReason,
  SecrethitlerPhaseKind,
  SecrethitlerState,
  SecrethitlerViewModel,
  SecrethitlerVoteMode,
} from '@game-judge/game-engine/games/secrethitler/public';

export const SECRETHITLER_PHASE_LABELS: Readonly<Record<SecrethitlerPhaseKind, string>> = {
  lobby: '等待入座',
  viewing: '查看身份',
  night: '首夜互认',
  election: '提名总理',
  voting: '政府投票',
  legislativePresident: '总统弃牌',
  legislativeChancellor: '总理施政',
  vetoResponse: '回应否决',
  publicResult: '结果展示',
  executive: '总统权力',
  investigationResult: '调查结果',
  ended: '本局结束',
};

export const SECRETHITLER_END_COPY: Readonly<Record<SecrethitlerEndReason, string>> = {
  liberalPolicies: '已施行五张自由派政策',
  fascistPolicies: '已施行六张法西斯政策',
  hitlerExecuted: '希特勒被处决',
  hitlerElected: '法西斯政策达到三张后，希特勒当选总理',
};

export const SECRETHITLER_POWER_COPY = {
  investigate: '调查阵营',
  specialElection: '特别选举',
  execute: '处决玩家',
  policyPeek: '政策预览',
} as const;

/** Formats the public election-result policy selected when the room is created. */
export function formatSecrethitlerVoteMode(voteMode: SecrethitlerVoteMode): string {
  return voteMode === 'public' ? '公投' : '暗投';
}

/** Public first-night progress label, never a private identity or seat. */
export function getSecrethitlerNightStepLabel(step: number): string {
  if (step !== 1) throw new Error(`Unknown Secret Hitler night step ${step}`);
  return '坏人互认';
}

function nightInstruction(
  state: SecrethitlerState,
  view: SecrethitlerViewModel,
): { readonly message: string; readonly action: string | null } {
  if (state.phase.kind !== 'night') throw new Error('Night instruction requires night phase');
  if (view.mySeat === null) return { message: '等待首夜互认完成', action: null };
  return {
    message: !view.canConfirmNight
      ? '请保持闭眼，等待本步玩家确认'
      : view.hasConfirmedNight
        ? '信息已确认，等待本步其他玩家确认'
        : '请点击「确认信息」，私下查看并确认互认信息',
    action: view.canConfirmNight && !view.hasConfirmedNight ? '确认信息' : null,
  };
}
/** Formats an occupied seat using public profile data only. */
export function secrethitlerSeatLabel(view: SecrethitlerViewModel, seat: number): string {
  const player = view.seats.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error(`Missing Secret Hitler seat ${seat}`);
  return `${seat + 1} 号 · ${player.displayName}`;
}

/** Personal guidance and the protected action entry for the current viewer. */
export function secrethitlerInstruction(
  state: SecrethitlerState,
  view: SecrethitlerViewModel,
): { readonly message: string; readonly action: string | null } {
  const seat = view.mySeat;
  const living = seat !== null && view.livingSeats.includes(seat);
  switch (state.phase.kind) {
    case 'lobby':
      return { message: '等待房主分配身份', action: null };
    case 'viewing':
      return {
        message: seat === null ? '等待玩家查看身份' : '请私下查看自己的身份，等待房主开始首夜',
        action: null,
      };
    case 'night':
      return nightInstruction(state, view);
    case 'election':
      if (state.isAudioPlaying)
        return {
          message: seat === null ? '等待首夜结束' : '互认结束，请闭眼等待电子主持通知睁眼',
          action: null,
        };
      return {
        message:
          state.phase.preselectedChancellorSeat === null
            ? `等待 ${secrethitlerSeatLabel(view, state.phase.presidentSeat)} 预选总理`
            : '总统已预选，正在确定最终总理',
        action:
          seat === state.phase.presidentSeat
            ? state.phase.preselectedChancellorSeat === null
              ? '预选总理'
              : '最终提名'
            : null,
      };
    case 'voting':
      return {
        message: living
          ? view.myVote === null
            ? state.config.voteMode === 'public'
              ? '请秘密投票，全员提交后同时公开选票'
              : '请秘密投票，全员提交后只公布赞成 / 反对票数'
            : '已投票，揭晓前可以改票'
          : '等待存活玩家投票',
        action: living ? (view.myVote === null ? '秘密投票' : '修改选票') : null,
      };
    case 'legislativePresident':
      return {
        message: '总统私下弃一张政策，将剩余两张交给总理',
        action: seat === state.phase.presidentSeat ? '查看并弃牌' : null,
      };
    case 'legislativeChancellor':
      return {
        message: state.phase.vetoRejected
          ? '总统拒绝否决，总理必须施行一张政策'
          : '总理私下施行一张政策',
        action: seat === state.phase.chancellorSeat ? '查看并施政' : null,
      };
    case 'vetoResponse':
      return {
        message: '总理请求否决，等待总统回应',
        action: seat === state.phase.presidentSeat ? '回应否决' : null,
      };
    case 'publicResult':
      return {
        message: '正在展示结果',
        action: null,
      };
    case 'executive':
      return {
        message: `等待总统执行${SECRETHITLER_POWER_COPY[state.phase.power]}`,
        action:
          seat === state.phase.presidentSeat ? SECRETHITLER_POWER_COPY[state.phase.power] : null,
      };
    case 'investigationResult':
      return {
        message: seat === state.phase.presidentSeat ? '请确认私密调查结果' : '等待总统确认调查结果',
        action: null,
      };
    case 'ended':
      return { message: SECRETHITLER_END_COPY[state.phase.reason], action: null };
  }
}

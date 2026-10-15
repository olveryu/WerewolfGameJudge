/**
 * Werewolf phase status copy — the single computation site for the
 * three host-facing faces of the same phase facts: the room guide
 * message (host variant), the host panel status and the host panel
 * preview. The hook and the host-management builder both read from
 * here so the faces cannot drift apart.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

export interface WerewolfPhaseStatusCopyInput {
  readonly roomStatus: GameStatus;
  readonly isPlagueMode: boolean;
  /** Sheriff election phase title while an election panel is active. */
  readonly sheriffPhaseTitle: string | null;
  /** Sheriff advance action label, only while the panel can advance. */
  readonly sheriffAdvanceLabel: string | null;
  readonly seatedCount: number;
  readonly totalSeats: number;
  readonly viewedCount: number;
}

export interface WerewolfPhaseStatusCopy {
  readonly hostGuideMessage: string | null;
  readonly hostStatus: string;
  readonly hostPreview: string;
}

function resolveHostGuideMessage(input: WerewolfPhaseStatusCopyInput): string | null {
  switch (input.roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated: {
      if (input.seatedCount === 0) return '等待玩家入座，或分享房间邀请好友';
      if (input.seatedCount < input.totalSeats)
        return `还有 ${input.totalSeats - input.seatedCount} 个空位等待入座`;
      return '全员已就位，等待房主分配角色';
    }
    case GameStatus.Assigned: {
      if (input.viewedCount < input.totalSeats) {
        return `${input.viewedCount}/${input.totalSeats} 位玩家已查看角色，等待剩余玩家`;
      }
      return null;
    }
    case GameStatus.Ready:
      return '全员就绪，等待房主开始游戏 🔊';
    case GameStatus.Ongoing:
    case GameStatus.Day:
      return null;
    case GameStatus.Ended:
      return '天亮了 →「昨夜信息」查看结果，「本局复盘」查看/分享战报';
    default:
      return null;
  }
}

function resolveHostStatus(input: WerewolfPhaseStatusCopyInput): string {
  if (input.sheriffPhaseTitle !== null) {
    return `警长竞选 · ${input.sheriffPhaseTitle}`;
  }
  switch (input.roomStatus) {
    case GameStatus.Unseated:
      return '等待玩家入座';
    case GameStatus.Seated:
      return '座位准备完成';
    case GameStatus.Assigned:
      return '角色已分配';
    case GameStatus.Ready:
      return input.isPlagueMode ? '真人法官主持中' : '角色确认完成';
    case GameStatus.Ongoing:
      return '夜间进行中';
    case GameStatus.Day:
      return '白天阶段';
    case GameStatus.Ended:
      return '游戏已结束';
  }
}

function resolveHostPreview(input: WerewolfPhaseStatusCopyInput): string {
  if (input.roomStatus === GameStatus.Seated) return '下一步：分配角色';
  if (input.roomStatus === GameStatus.Ready && !input.isPlagueMode) return '下一步：开始游戏';
  if (input.roomStatus === GameStatus.Day && input.sheriffAdvanceLabel !== null) {
    return `待处理：${input.sheriffAdvanceLabel}`;
  }
  if (input.roomStatus === GameStatus.Ended) return '可重新开始';
  switch (input.roomStatus) {
    case GameStatus.Unseated:
      return '房间配置与座位管理';
    case GameStatus.Assigned:
      return '角色确认与重开';
    case GameStatus.Ready:
      return '真人法官主持中';
    case GameStatus.Ongoing:
      return '夜间工具与重开';
    case GameStatus.Day:
      return input.sheriffPhaseTitle === null ? '白天工具与重开' : '警长竞选进行中';
    default:
      // Seated and Ended returned above.
      throw new Error('[FAIL-FAST] Werewolf host preview requires a room status');
  }
}

export function resolveWerewolfPhaseStatusCopy(
  input: WerewolfPhaseStatusCopyInput,
): WerewolfPhaseStatusCopy {
  return {
    hostGuideMessage: resolveHostGuideMessage(input),
    hostStatus: resolveHostStatus(input),
    hostPreview: resolveHostPreview(input),
  };
}

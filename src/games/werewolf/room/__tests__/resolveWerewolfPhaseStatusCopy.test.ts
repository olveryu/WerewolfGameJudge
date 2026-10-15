import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  resolveWerewolfPhaseStatusCopy,
  type WerewolfPhaseStatusCopyInput,
} from '../resolveWerewolfPhaseStatusCopy';

function buildInput(
  overrides: Partial<WerewolfPhaseStatusCopyInput> = {},
): WerewolfPhaseStatusCopyInput {
  return {
    roomStatus: GameStatus.Unseated,
    isPlagueMode: false,
    sheriffPhaseTitle: null,
    sheriffAdvanceLabel: null,
    seatedCount: 0,
    totalSeats: 9,
    viewedCount: 0,
    ...overrides,
  };
}

describe('resolveWerewolfPhaseStatusCopy', () => {
  it('unseated with an empty room', () => {
    expect(resolveWerewolfPhaseStatusCopy(buildInput())).toEqual({
      hostGuideMessage: '等待玩家入座，或分享房间邀请好友',
      hostStatus: '等待玩家入座',
      hostPreview: '房间配置与座位管理',
    });
  });

  it('seated with seats still open', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(buildInput({ roomStatus: GameStatus.Seated, seatedCount: 3 })),
    ).toEqual({
      hostGuideMessage: '还有 6 个空位等待入座',
      hostStatus: '座位准备完成',
      hostPreview: '下一步：分配角色',
    });
  });

  it('seated with a full room', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(buildInput({ roomStatus: GameStatus.Seated, seatedCount: 9 }))
        .hostGuideMessage,
    ).toBe('全员已就位，等待房主分配角色');
  });

  it('assigned while players are still viewing', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({ roomStatus: GameStatus.Assigned, seatedCount: 9, viewedCount: 4 }),
      ),
    ).toEqual({
      hostGuideMessage: '4/9 位玩家已查看角色，等待剩余玩家',
      hostStatus: '角色已分配',
      hostPreview: '角色确认与重开',
    });
  });

  it('assigned with everyone viewed clears the guide message', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({ roomStatus: GameStatus.Assigned, seatedCount: 9, viewedCount: 9 }),
      ).hostGuideMessage,
    ).toBeNull();
  });

  it('ready in a normal game', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({ roomStatus: GameStatus.Ready, seatedCount: 9, viewedCount: 9 }),
      ),
    ).toEqual({
      hostGuideMessage: '全员就绪，等待房主开始游戏 🔊',
      hostStatus: '角色确认完成',
      hostPreview: '下一步：开始游戏',
    });
  });

  it('ready in plague mode is hosted by a human judge', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({ roomStatus: GameStatus.Ready, isPlagueMode: true }),
      ),
    ).toEqual({
      hostGuideMessage: '全员就绪，等待房主开始游戏 🔊',
      hostStatus: '真人法官主持中',
      hostPreview: '真人法官主持中',
    });
  });

  it('ongoing night', () => {
    expect(resolveWerewolfPhaseStatusCopy(buildInput({ roomStatus: GameStatus.Ongoing }))).toEqual({
      hostGuideMessage: null,
      hostStatus: '夜间进行中',
      hostPreview: '夜间工具与重开',
    });
  });

  it('day without a sheriff election', () => {
    expect(resolveWerewolfPhaseStatusCopy(buildInput({ roomStatus: GameStatus.Day }))).toEqual({
      hostGuideMessage: null,
      hostStatus: '白天阶段',
      hostPreview: '白天工具与重开',
    });
  });

  it('day with a sheriff election that cannot advance yet', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({ roomStatus: GameStatus.Day, sheriffPhaseTitle: '投票中' }),
      ),
    ).toEqual({
      hostGuideMessage: null,
      hostStatus: '警长竞选 · 投票中',
      hostPreview: '警长竞选进行中',
    });
  });

  it('day with a sheriff election waiting on the host', () => {
    expect(
      resolveWerewolfPhaseStatusCopy(
        buildInput({
          roomStatus: GameStatus.Day,
          sheriffPhaseTitle: '公布结果',
          sheriffAdvanceLabel: '公布警长竞选结果',
        }),
      ).hostPreview,
    ).toBe('待处理：公布警长竞选结果');
  });

  it('ended', () => {
    expect(resolveWerewolfPhaseStatusCopy(buildInput({ roomStatus: GameStatus.Ended }))).toEqual({
      hostGuideMessage: '天亮了 →「昨夜信息」查看结果，「本局复盘」查看/分享战报',
      hostStatus: '游戏已结束',
      hostPreview: '可重新开始',
    });
  });
});

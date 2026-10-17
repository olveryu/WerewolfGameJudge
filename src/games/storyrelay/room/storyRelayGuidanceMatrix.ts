/**
 * 故事接龙（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * storyRelayGuidanceMatrix.test.ts 用真实引擎流驱动
 * createStoryRelayRoomShellModel 对账为准。本家底部 message 只存在于
 * 大厅等待句；局中引导由对局工作区与底部进度行分工承载，逐格登记。
 */
import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const STORY_RELAY_GUIDANCE_MATRIX: RoomGuidanceMatrix<StoryRelayState['phase']> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载开始动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  answering: {
    host: guidanceExempt('写作与作答在对局工作区内完成，步进归底部进度行'),
    seated: guidanceExempt('写作与作答在对局工作区内完成，步进归底部进度行'),
    spectator: guidanceExempt('作答进程由对局工作区与底部进度行承载'),
  },
  settling: {
    host: guidanceExempt('结算过渡由对局工作区呈现'),
    seated: guidanceExempt('结算过渡由对局工作区呈现'),
    spectator: guidanceExempt('结算过渡由对局工作区呈现'),
  },
  transition: {
    host: guidanceExempt('下一棒准备由底部进度行承载'),
    seated: guidanceExempt('下一棒准备由底部进度行承载'),
    spectator: guidanceExempt('下一棒准备由底部进度行承载'),
  },
  gallery: {
    host: guidanceExempt('画廊在对局工作区由房主控制播放，步进归底部进度行'),
    seated: guidanceExempt(
      '画廊在对局工作区播放，工作区有「由房主控制播放进度。」提示，步进归底部进度行',
    ),
    spectator: guidanceExempt(
      '画廊在对局工作区播放，工作区有「由房主控制播放进度。」提示，步进归底部进度行',
    ),
  },
  aborted: {
    host: guidanceExempt('中止标记在工作区故事标题；房主后续动作归房主面板'),
    seated: guidanceExempt('中止标记在工作区故事标题（未完成，房主中止）'),
    spectator: guidanceExempt('中止标记在工作区故事标题（未完成，房主中止）'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载再来一局 / 返回大厅'),
    seated: guidanceExempt('故事揭晓在对局工作区，房主后续动作归房主面板'),
    spectator: guidanceExempt('故事揭晓在对局工作区'),
  },
};

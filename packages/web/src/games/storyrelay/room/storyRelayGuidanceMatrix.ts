/**
 * 故事接龙（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * storyRelayGuidanceMatrix.test.ts 用真实引擎流驱动
 * createStoryRelayRoomShellModel 对账为准。本家底部 message 只存在于
 * 大厅等待句；局中引导由舞台（含顶部信息条）与画廊工作区承载，逐格登记。
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
    host: guidanceExempt('舞台内容：写作在舞台，第几段、准备名单与倒计时在顶部信息条'),
    seated: guidanceExempt('舞台内容：写作在舞台，第几段、准备名单与倒计时在顶部信息条'),
    spectator: guidanceExempt('舞台内容：写作进程由舞台与顶部信息条呈现'),
  },
  settling: {
    host: guidanceExempt('舞台内容：收稿过渡在舞台，收稿名单在顶部信息条'),
    seated: guidanceExempt('舞台内容：收稿过渡在舞台，收稿名单在顶部信息条'),
    spectator: guidanceExempt('舞台内容：收稿过渡在舞台，收稿名单在顶部信息条'),
  },
  transition: {
    host: guidanceExempt('舞台内容：下一棒准备由顶部信息条的「换棒」倒计时承载'),
    seated: guidanceExempt('舞台内容：下一棒准备由顶部信息条的「换棒」倒计时承载'),
    spectator: guidanceExempt('舞台内容：下一棒准备由顶部信息条的「换棒」倒计时承载'),
  },
  gallery: {
    host: guidanceExempt('画廊在对局工作区由房主控制播放，第几篇归工作区故事标题'),
    seated: guidanceExempt(
      '画廊在对局工作区播放，工作区有「由房主控制播放进度。」提示，第几篇归工作区故事标题',
    ),
    spectator: guidanceExempt(
      '画廊在对局工作区播放，工作区有「由房主控制播放进度。」提示，第几篇归工作区故事标题',
    ),
  },
  aborted: {
    host: guidanceExempt('中止标记在工作区故事标题；本局复盘归底部按钮，房主后续动作归房主面板'),
    seated: guidanceExempt('中止标记在工作区故事标题（未完成，房主中止）；本局复盘归底部按钮'),
    spectator: guidanceExempt('中止标记在工作区故事标题（未完成，房主中止）；本局复盘归底部按钮'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载本局复盘 / 再来一局 / 返回大厅'),
    seated: guidanceExempt('故事揭晓在对局工作区，本局复盘归底部按钮，房主后续动作归房主面板'),
    spectator: guidanceExempt('故事揭晓在对局工作区，本局复盘归底部按钮'),
  },
};

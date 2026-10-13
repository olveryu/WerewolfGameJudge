/** 故事接龙命令失败文案：每个引擎英文码都映射到原中文文案，不落通用兜底。 */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';

describe('getStoryRelayRoomCommandFailureMessage', () => {
  it.each([
    ['storyrelay_config_invalid', '故事接龙配置无效'],
    ['storyrelay_phase_invalid', '当前阶段不能执行此操作'],
    ['storyrelay_task_changed', '故事任务已变化，请刷新后重试'],
    ['storyrelay_already_submitted', '本棒已收稿'],
    ['storyrelay_text_invalid', '请填写 1 至 512 字符的正文'],
    ['storyrelay_room_not_full', '请先坐满所有座位，或填充机器人。'],
    [
      'storyrelay_occupied_seat_out_of_range',
      '目标人数之外的座位仍有玩家入座，请先让这些玩家离座或换到空位',
    ],
    ['storyrelay_deadline_not_reached', '当前阶段尚未到推进时间'],
    ['storyrelay_manual_paging', '当前为手动翻页'],
  ])('maps %s to its copy', (reason, copy) => {
    expect(
      getStoryRelayRoomCommandFailureMessage(rejectedRoomCommand<StoryRelayState>(reason, 'cmd')),
    ).toBe(copy);
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getStoryRelayRoomCommandFailureMessage(
        rejectedRoomCommand<StoryRelayState>('room_initialization_conflict', 'cmd'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });
});

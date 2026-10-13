/** Presents shared and Story Relay command failures without exposing command payloads. */

import {
  STORY_RELAY_REASONS,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE_WITH_MOVE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/session/createRoomCommandFailureMessage';

/**
 * Story Relay's failure copy lives here, keyed by the engine's stable
 * English reason codes (AU-48). It previously sat in the global reason
 * table as Chinese-to-Chinese identity entries.
 */
export const getStoryRelayRoomCommandFailureMessage =
  createRoomCommandFailureMessage<StoryRelayState>({
    [STORY_RELAY_REASONS.config]: '故事接龙配置无效',
    [STORY_RELAY_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [STORY_RELAY_REASONS.task]: '故事任务已变化，请刷新后重试',
    [STORY_RELAY_REASONS.submitted]: '本棒已收稿',
    [STORY_RELAY_REASONS.text]: '请填写 1 至 512 字符的正文',
    [STORY_RELAY_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [STORY_RELAY_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE_WITH_MOVE,
    [STORY_RELAY_REASONS.deadline]: '当前阶段尚未到推进时间',
    [STORY_RELAY_REASONS.manual]: '当前为手动翻页',
  });

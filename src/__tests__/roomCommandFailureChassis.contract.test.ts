/**
 * Room Command Failure Chassis — contract (B-2).
 *
 * Platform (chassis) reason codes are chassis vocabulary: their user
 * copy lives in exactly one table (`ROOM_CHASSIS_REASON_MESSAGES`), and
 * game presenter maps carry gameplay reasons only. These pins keep a
 * game map from re-introducing its own sentence for a chassis code —
 * the fork that left `controlled_seat_not_bot` with three different
 * sentences across three games, one of them describing a different
 * rejection (not_seated) entirely.
 */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';
import type { DemoState } from '@game-judge/game-engine/games/demo/public';
import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';
import type { FibState } from '@game-judge/game-engine/games/fibking/public';
import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import type { GameState as WerewolfState } from '@game-judge/game-engine/games/werewolf/public';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_ROOM_EFFECTS_PENDING,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_ROOM_INSTANCE_MISMATCH,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '@game-judge/game-engine/platform/protocol/reasons';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { getAvalonRoomCommandFailureMessage } from '@/games/avalon/room/avalonRoomCommandFailureMessage';
import { getDemoRoomCommandFailureMessage } from '@/games/demo/room/demoRoomCommandFailureMessage';
import { getDrawGuessRoomCommandFailureMessage } from '@/games/drawguess/room/drawGuessRoomCommandFailureMessage';
import { getFibRoomCommandFailureMessage } from '@/games/fibking/room/fibRoomCommandFailureMessage';
import { getPictionaryRoomCommandFailureMessage } from '@/games/pictionary/room/pictionaryRoomCommandFailureMessage';
import { getStoryRelayRoomCommandFailureMessage } from '@/games/storyrelay/room/storyRelayRoomCommandFailureMessage';
import { getUndercoverRoomCommandFailureMessage } from '@/games/undercover/room/undercoverRoomCommandFailureMessage';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/werewolfRoomCommandFailureMessage';
import { rejectedRoomCommand } from '@/test-utils/roomCommand';
import { translateReasonCode } from '@/utils/errorUtils';
import { ROOM_CHASSIS_REASON_MESSAGES } from '@/utils/roomChassisReasonMessages';

const REPO_ROOT = join(__dirname, '..', '..');

function readSource(relativePath: string): string {
  const fullPath = join(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

/** Every platform room-operation reason code the engine can emit. */
const ALL_PLATFORM_REASONS = [
  REASON_NOT_AUTHENTICATED,
  REASON_NO_STATE,
  REASON_INVALID_SEAT,
  REASON_SEAT_TAKEN,
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_SEATED,
  REASON_NOT_HOST,
  REASON_SEAT_EMPTY,
  REASON_USER_ACTOR_REQUIRED,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_COMMAND_ID_CONFLICT,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_ROOM_EFFECTS_PENDING,
  REASON_ROOM_INSTANCE_MISMATCH,
] as const;

/**
 * The codes with established copy in the chassis table. The remaining
 * three have no established copy (see roomChassisReasonMessages.ts) and
 * fall through to the generic fallback on every surface alike.
 */
const COVERED_PLATFORM_REASONS = [
  REASON_NOT_AUTHENTICATED,
  REASON_NO_STATE,
  REASON_INVALID_SEAT,
  REASON_SEAT_TAKEN,
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_SEATED,
  REASON_NOT_HOST,
  REASON_SEAT_EMPTY,
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_COMMAND_ID_CONFLICT,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_ROOM_EFFECTS_PENDING,
] as const;

const PRESENTERS: ReadonlyArray<{ game: string; present: (reason: string) => string }> = [
  {
    game: 'avalon',
    present: (reason) =>
      getAvalonRoomCommandFailureMessage(rejectedRoomCommand<AvalonState>(reason, 'chassis-pin')),
  },
  {
    game: 'demo',
    present: (reason) =>
      getDemoRoomCommandFailureMessage(rejectedRoomCommand<DemoState>(reason, 'chassis-pin')),
  },
  {
    game: 'drawguess',
    present: (reason) =>
      getDrawGuessRoomCommandFailureMessage(
        rejectedRoomCommand<DrawGuessState>(reason, 'chassis-pin'),
      ),
  },
  {
    game: 'fibking',
    present: (reason) =>
      getFibRoomCommandFailureMessage(rejectedRoomCommand<FibState>(reason, 'chassis-pin')),
  },
  {
    game: 'pictionary',
    present: (reason) =>
      getPictionaryRoomCommandFailureMessage(
        rejectedRoomCommand<PictionaryState>(reason, 'chassis-pin'),
      ),
  },
  {
    game: 'storyrelay',
    present: (reason) =>
      getStoryRelayRoomCommandFailureMessage(
        rejectedRoomCommand<StoryRelayState>(reason, 'chassis-pin'),
      ),
  },
  {
    game: 'undercover',
    present: (reason) =>
      getUndercoverRoomCommandFailureMessage(
        rejectedRoomCommand<UndercoverState>(reason, 'chassis-pin'),
      ),
  },
  {
    game: 'werewolf',
    present: (reason) =>
      getWerewolfRoomCommandFailureMessage(
        rejectedRoomCommand<WerewolfState>(reason, 'chassis-pin'),
      ),
  },
];

/** Game presenter sources (plus the generator template) scanned for chassis entries. */
const PRESENTER_SOURCES = [
  'src/games/avalon/room/avalonRoomCommandFailureMessage.ts',
  'src/games/demo/room/demoRoomCommandFailureMessage.ts',
  'src/games/drawguess/room/drawGuessRoomCommandFailureMessage.ts',
  'src/games/fibking/room/fibRoomCommandFailureMessage.ts',
  'src/games/pictionary/room/pictionaryRoomCommandFailureMessage.ts',
  'src/games/storyrelay/room/storyRelayRoomCommandFailureMessage.ts',
  'src/games/undercover/room/undercoverRoomCommandFailureMessage.ts',
  'src/games/werewolf/werewolfRoomCommandFailureMessage.ts',
  'scripts/lib/new-game/templates/shared/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomCommandFailureMessage.ts.tmpl',
];

describe('room command failure chassis copy (B-2)', () => {
  it('the chassis table keys are exactly the covered platform codes', () => {
    expect(Object.keys(ROOM_CHASSIS_REASON_MESSAGES).sort()).toEqual(
      [...COVERED_PLATFORM_REASONS].sort(),
    );
  });

  it('every presenter agrees with the shared translator on every platform code', () => {
    const mismatches: string[] = [];
    for (const { game, present } of PRESENTERS) {
      for (const reason of ALL_PLATFORM_REASONS) {
        const actual = present(reason);
        const expected = translateReasonCode(reason);
        if (actual !== expected) {
          mismatches.push(`${game}/${reason}: presenter "${actual}" vs translator "${expected}"`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every presenter shows the chassis table sentence for every covered code', () => {
    const mismatches: string[] = [];
    for (const { game, present } of PRESENTERS) {
      for (const reason of COVERED_PLATFORM_REASONS) {
        const actual = present(reason);
        const expected = ROOM_CHASSIS_REASON_MESSAGES[reason];
        if (actual !== expected) {
          mismatches.push(`${game}/${reason}: presenter "${actual}" vs chassis "${expected}"`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('no game presenter source references a platform reason code', () => {
    const offenders: string[] = [];
    for (const relativePath of PRESENTER_SOURCES) {
      const source = readSource(relativePath);
      for (const reason of ALL_PLATFORM_REASONS) {
        if (source.includes(`'${reason}'`) || source.includes(`"${reason}"`)) {
          offenders.push(`${relativePath}: literal '${reason}'`);
        }
      }
      if (source.includes('platform/protocol/reasons')) {
        offenders.push(`${relativePath}: imports platform/protocol/reasons`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

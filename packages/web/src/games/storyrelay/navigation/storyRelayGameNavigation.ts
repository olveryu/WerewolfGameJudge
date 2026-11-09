/** Story Relay route parsers; navigation hosts receive validated game-owned parameters. */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type StoryRelayConfigRouteParams = StandardConfigRouteParams<'storyrelay'>;

/** Parses only create or active-room edit settings routes. */
export const parseStoryRelayConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'storyrelay',
  displayName: 'Story Relay',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'storyrelay',
  displayName: 'Story Relay',
});

export const storyRelayGameNavigation = defineGameNavigation({
  gameType: 'storyrelay',
  config: { kind: 'screen', parseParams: parseStoryRelayConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});

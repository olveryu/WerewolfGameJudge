/** Product background-music metadata and static asset registry. */

import bgmBathroomDance from '../../../../../../assets/bgm/bathroom_dance.m4a';
import bgmCallMeJoker from '../../../../../../assets/bgm/call_me_joker.m4a';
import bgmDefeatedClown from '../../../../../../assets/bgm/defeated_clown.m4a';
import bgmFinale from '../../../../../../assets/bgm/finale.m4a';
import bgmGustave from '../../../../../../assets/bgm/gustave.m4a';
import bgmLumiereALaube from '../../../../../../assets/bgm/lumiere_a_laube.m4a';
import bgmSpeakSoftlyLove from '../../../../../../assets/bgm/speak_softly_love.m4a';
import bgmTheGodfatherWaltz from '../../../../../../assets/bgm/the_godfather_waltz.m4a';
import bgmTheImmigrant from '../../../../../../assets/bgm/the_immigrant.m4a';

type BgmTrackId =
  | 'finale'
  | 'speakSoftlyLove'
  | 'theGodfatherWaltz'
  | 'theImmigrant'
  | 'gustave'
  | 'lumiereALaube'
  | 'defeatedClown'
  | 'bathroomDance'
  | 'callMeJoker';

/** One selectable background-music track. */
export interface BgmTrackEntry {
  readonly id: BgmTrackId;
  readonly label: string;
  readonly subtitle: string;
  readonly mood: string;
  readonly url: string;
}

export const BGM_TRACKS: readonly BgmTrackEntry[] = [
  {
    id: 'theGodfatherWaltz',
    label: 'The Godfather Waltz',
    subtitle: '教父华尔兹',
    mood: '优雅庄重',
    url: bgmTheGodfatherWaltz,
  },
  {
    id: 'speakSoftlyLove',
    label: 'Speak Softly Love',
    subtitle: '温柔倾诉',
    mood: '浪漫深情',
    url: bgmSpeakSoftlyLove,
  },
  {
    id: 'theImmigrant',
    label: 'The Immigrant',
    subtitle: '移民者',
    mood: '悠远苍凉',
    url: bgmTheImmigrant,
  },
  {
    id: 'finale',
    label: 'Finale',
    subtitle: '终曲',
    mood: '紧张宏大',
    url: bgmFinale,
  },
  {
    id: 'gustave',
    label: 'Gustave',
    subtitle: '古斯塔夫',
    mood: '深情忧伤',
    url: bgmGustave,
  },
  {
    id: 'lumiereALaube',
    label: "Lumière à l'Aube",
    subtitle: '破晓微光',
    mood: '空灵静谧',
    url: bgmLumiereALaube,
  },
  {
    id: 'defeatedClown',
    label: 'Defeated Clown',
    subtitle: '落败小丑',
    mood: '阴郁沉重',
    url: bgmDefeatedClown,
  },
  {
    id: 'bathroomDance',
    label: 'Bathroom Dance',
    subtitle: '浴室之舞',
    mood: '诡谲压抑',
    url: bgmBathroomDance,
  },
  {
    id: 'callMeJoker',
    label: 'Call Me Joker',
    subtitle: '小丑降临',
    mood: '癫狂张扬',
    url: bgmCallMeJoker,
  },
] as const;

const VALID_BGM_TRACK_IDS: ReadonlySet<string> = new Set<BgmTrackId>(
  BGM_TRACKS.map((track) => track.id),
);

const BGM_TRACK_BY_ID = new Map(BGM_TRACKS.map((track) => [track.id, track]));
if (BGM_TRACK_BY_ID.size !== BGM_TRACKS.length) {
  throw new Error('[FAIL-FAST] Duplicate BGM track registration');
}

function getBgmTrack(trackId: BgmTrackId): BgmTrackEntry {
  const track = BGM_TRACK_BY_ID.get(trackId);
  if (track === undefined) {
    throw new Error(`[FAIL-FAST] Missing BGM track ${trackId}`);
  }
  return track;
}

/** A specific track, or `'random'` for the shuffled playlist of every track. */
export type BgmTrackSetting = BgmTrackId | 'random';

export function isBgmTrackSetting(value: unknown): value is BgmTrackSetting {
  return value === 'random' || (typeof value === 'string' && VALID_BGM_TRACK_IDS.has(value));
}

/**
 * The URLs `BgmPlayer.start` receives for a track setting: every track for `'random'`
 * (the player shuffles a multi-track list), otherwise the one selected track (looped).
 */
export function resolveBgmTrackUrls(track: BgmTrackSetting): string[] {
  if (track === 'random') return BGM_TRACKS.map((entry) => entry.url);
  return [getBgmTrack(track).url];
}

/** Default BGM volume (0.0–1.0). */
export const BGM_VOLUME = 0.5;

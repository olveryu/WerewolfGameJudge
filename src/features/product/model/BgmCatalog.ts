/** Product background-music metadata and static asset registry. */

import bgmBathroomDance from '../../../../assets/bgm/bathroom_dance.m4a';
import bgmCallMeJoker from '../../../../assets/bgm/call_me_joker.m4a';
import bgmDefeatedClown from '../../../../assets/bgm/defeated_clown.m4a';
import bgmFinale from '../../../../assets/bgm/finale.m4a';
import bgmGustave from '../../../../assets/bgm/gustave.m4a';
import bgmLumiereALaube from '../../../../assets/bgm/lumiere_a_laube.m4a';
import bgmSpeakSoftlyLove from '../../../../assets/bgm/speak_softly_love.m4a';
import bgmTheGodfatherWaltz from '../../../../assets/bgm/the_godfather_waltz.m4a';
import bgmTheImmigrant from '../../../../assets/bgm/the_immigrant.m4a';
import type { AudioAsset } from './AudioClip';

export type BgmTrackId =
  | 'finale'
  | 'speakSoftlyLove'
  | 'theGodfatherWaltz'
  | 'theImmigrant'
  | 'gustave'
  | 'lumiereALaube'
  | 'defeatedClown'
  | 'bathroomDance'
  | 'callMeJoker';

export interface BgmTrackEntry {
  readonly id: BgmTrackId;
  readonly label: string;
  readonly subtitle: string;
  readonly mood: string;
  readonly asset: AudioAsset;
}

export const BGM_TRACKS: readonly BgmTrackEntry[] = [
  {
    id: 'theGodfatherWaltz',
    label: 'The Godfather Waltz',
    subtitle: '教父华尔兹',
    mood: '优雅庄重',
    asset: bgmTheGodfatherWaltz,
  },
  {
    id: 'speakSoftlyLove',
    label: 'Speak Softly Love',
    subtitle: '温柔倾诉',
    mood: '浪漫深情',
    asset: bgmSpeakSoftlyLove,
  },
  {
    id: 'theImmigrant',
    label: 'The Immigrant',
    subtitle: '移民者',
    mood: '悠远苍凉',
    asset: bgmTheImmigrant,
  },
  {
    id: 'finale',
    label: 'Finale',
    subtitle: '终曲',
    mood: '紧张宏大',
    asset: bgmFinale,
  },
  {
    id: 'gustave',
    label: 'Gustave',
    subtitle: '古斯塔夫',
    mood: '深情忧伤',
    asset: bgmGustave,
  },
  {
    id: 'lumiereALaube',
    label: "Lumière à l'Aube",
    subtitle: '破晓微光',
    mood: '空灵静谧',
    asset: bgmLumiereALaube,
  },
  {
    id: 'defeatedClown',
    label: 'Defeated Clown',
    subtitle: '落败小丑',
    mood: '阴郁沉重',
    asset: bgmDefeatedClown,
  },
  {
    id: 'bathroomDance',
    label: 'Bathroom Dance',
    subtitle: '浴室之舞',
    mood: '诡谲压抑',
    asset: bgmBathroomDance,
  },
  {
    id: 'callMeJoker',
    label: 'Call Me Joker',
    subtitle: '小丑降临',
    mood: '癫狂张扬',
    asset: bgmCallMeJoker,
  },
] as const;

const VALID_BGM_TRACK_IDS: ReadonlySet<string> = new Set<BgmTrackId>(
  BGM_TRACKS.map((track) => track.id),
);

const BGM_TRACK_BY_ID = new Map(BGM_TRACKS.map((track) => [track.id, track]));
if (BGM_TRACK_BY_ID.size !== BGM_TRACKS.length) {
  throw new Error('[FAIL-FAST] Duplicate BGM track registration');
}

export function getBgmTrack(trackId: BgmTrackId): BgmTrackEntry {
  const track = BGM_TRACK_BY_ID.get(trackId);
  if (track === undefined) {
    throw new Error(`[FAIL-FAST] Missing BGM track ${trackId}`);
  }
  return track;
}

export type BgmTrackSetting = BgmTrackId | 'random';

export function isBgmTrackSetting(value: unknown): value is BgmTrackSetting {
  return value === 'random' || (typeof value === 'string' && VALID_BGM_TRACK_IDS.has(value));
}

export const BGM_VOLUME = 0.5;

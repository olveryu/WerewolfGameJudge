import { BGM_TRACKS, resolveBgmTrackUrls } from '@/features/product/model/BgmCatalog';

describe('resolveBgmTrackUrls', () => {
  it('resolves random to every track and a track id to that one track', () => {
    const finale = BGM_TRACKS.find((track) => track.id === 'finale');

    expect(resolveBgmTrackUrls('random')).toEqual(BGM_TRACKS.map((track) => track.url));
    expect(resolveBgmTrackUrls('finale')).toEqual([finale?.url]);
  });
});

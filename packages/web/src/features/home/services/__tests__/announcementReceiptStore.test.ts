import { LAST_SEEN_ANNOUNCEMENT_VERSION_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

import { hasSeenAnnouncement, markAnnouncementSeen } from '../announcementReceiptStore';

describe('announcementReceiptStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('compares one canonical stored version', () => {
    expect(hasSeenAnnouncement('2.6.0')).toBe(false);
    markAnnouncementSeen('2.6.0');
    expect(hasSeenAnnouncement('2.6.0')).toBe(true);
    expect(hasSeenAnnouncement('2.6.1')).toBe(false);
  });

  it('fails fast for an empty stored version', () => {
    storage.set(LAST_SEEN_ANNOUNCEMENT_VERSION_KEY, '');
    expect(() => hasSeenAnnouncement('2.6.0')).toThrow('must not be empty');
  });
});

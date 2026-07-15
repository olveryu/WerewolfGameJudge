import { LAST_SEEN_ANNOUNCEMENT_VERSION_KEY } from '@/config/storageKeys';
import {
  hasSeenAnnouncement,
  markAnnouncementSeen,
} from '@/features/home/services/announcementReceiptStore';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
  },
}));

describe('announcementReceiptStore', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('compares one canonical stored version', () => {
    expect(hasSeenAnnouncement('2.6.0')).toBe(false);
    markAnnouncementSeen('2.6.0');
    expect(hasSeenAnnouncement('2.6.0')).toBe(true);
    expect(hasSeenAnnouncement('2.6.1')).toBe(false);
  });

  it('fails fast for an empty stored version', () => {
    mockStoredValues.set(LAST_SEEN_ANNOUNCEMENT_VERSION_KEY, '');
    expect(() => hasSeenAnnouncement('2.6.0')).toThrow('must not be empty');
  });
});

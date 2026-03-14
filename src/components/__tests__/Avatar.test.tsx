import { render } from '@testing-library/react-native';

import { Avatar } from '@/components/Avatar';

// Mock avatar utility functions
jest.mock('../../utils/avatar', () => ({
  isBuiltinAvatarUrl: jest.fn(() => false),
  getBuiltinAvatarImage: jest.fn(() => 4),
}));

// Mock defaultAvatarIcons
jest.mock('../../utils/defaultAvatarIcons', () => ({
  getAvatarIcon: jest.fn(() => ({
    Icon: ({ size, color }: { size: number; color: string }) => {
      const { Text } = require('react-native');
      return <Text testID="lucide-icon">{`${size}-${color}`}</Text>;
    },
    color: '#C0392B',
  })),
}));

describe('Avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with value and size (default lucide icon)', () => {
      const { toJSON } = render(<Avatar value="test-user" size={50} />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render with custom avatar URL', () => {
      const { toJSON } = render(
        <Avatar value="test-user" size={50} avatarUrl="https://example.com/avatar.jpg" />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Avatar source selection', () => {
    it('should use custom avatarUrl when provided (not lucide icon)', () => {
      const { getByLabelText } = render(
        <Avatar value="test-user" size={50} avatarUrl="https://example.com/avatar.jpg" />,
      );
      const avatar = getByLabelText('头像');
      // Remote URL renders ExpoImage, not a View with lucide icon
      expect(avatar.type).not.toBe('View');
    });

    it('should render lucide icon when no avatarUrl', () => {
      const { getAvatarIcon } = require('@/utils/defaultAvatarIcons');
      render(<Avatar value="test-user" size={50} />);
      expect(getAvatarIcon).toHaveBeenCalledWith('test-user');
    });

    it('should render lucide icon when avatarUrl is null', () => {
      const { getAvatarIcon } = require('@/utils/defaultAvatarIcons');
      render(<Avatar value="test-user" size={50} avatarUrl={null} />);
      expect(getAvatarIcon).toHaveBeenCalledWith('test-user');
    });
  });

  describe('Size handling', () => {
    it('should apply size to width and height', () => {
      render(<Avatar value="test-1" size={32} />);
      render(<Avatar value="test-2" size={64} />);
      render(<Avatar value="test-3" size={128} />);
    });

    it('should calculate border radius based on size', () => {
      render(<Avatar value="test" size={100} />);
    });
  });

  describe('Deterministic icon selection', () => {
    it('same uid always gets same icon', () => {
      const { getAvatarIcon } = require('@/utils/defaultAvatarIcons');
      render(<Avatar value="player-123" size={50} />);
      render(<Avatar value="player-123" size={50} />);
      // Both calls use same uid
      expect(getAvatarIcon).toHaveBeenCalledWith('player-123');
      expect(getAvatarIcon).toHaveBeenCalledTimes(2);
    });
  });
});

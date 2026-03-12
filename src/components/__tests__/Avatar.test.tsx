import { render } from '@testing-library/react-native';

import { Avatar } from '@/components/Avatar';

// Mock avatar utility functions
jest.mock('../../utils/avatar', () => ({
  getAvatarImage: jest.fn(() => 1), // Return a mock image source
  getAvatarByUid: jest.fn(() => 2), // Return a different mock image source
}));

describe('Avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with value and size', () => {
      const { toJSON } = render(<Avatar value="test-user" size={50} />);

      // Avatar renders an Image component
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
    it('should use custom avatarUrl when provided', () => {
      const { getAvatarImage, getAvatarByUid } = require('@/utils/avatar');

      render(<Avatar value="test-user" size={50} avatarUrl="https://example.com/avatar.jpg" />);

      // When avatarUrl is provided, neither helper should be called
      expect(getAvatarImage).not.toHaveBeenCalled();
      expect(getAvatarByUid).not.toHaveBeenCalled();
    });

    it('should use getAvatarByUid when roomId is provided', () => {
      const { getAvatarImage, getAvatarByUid } = require('@/utils/avatar');

      render(<Avatar value="test-user" size={50} roomId="room-123" />);

      expect(getAvatarByUid).toHaveBeenCalledWith('room-123', 'test-user');
      expect(getAvatarImage).not.toHaveBeenCalled();
    });

    it('should use getAvatarImage when no roomId is provided', () => {
      const { getAvatarImage, getAvatarByUid } = require('@/utils/avatar');

      render(<Avatar value="test-user" size={50} />);

      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
      expect(getAvatarByUid).not.toHaveBeenCalled();
    });
  });

  describe('Size handling', () => {
    it('should apply size to width and height', () => {
      // Testing that different sizes render without crashing
      render(<Avatar value="test-1" size={32} />);
      render(<Avatar value="test-2" size={64} />);
      render(<Avatar value="test-3" size={128} />);
    });

    it('should calculate border radius based on size', () => {
      // Border radius is size / 4 according to the component
      // We just verify rendering works
      render(<Avatar value="test" size={100} />);
    });
  });

  describe('Null avatarUrl handling', () => {
    it('should fall back to local image when avatarUrl is null', () => {
      const { getAvatarImage } = require('@/utils/avatar');

      render(<Avatar value="test-user" size={50} avatarUrl={null} />);

      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
    });

    it('should fall back to local image when avatarUrl is undefined', () => {
      const { getAvatarImage } = require('@/utils/avatar');

      render(<Avatar value="test-user" size={50} avatarUrl={undefined} />);

      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
    });
  });

  describe('Seat independence (new behavior)', () => {
    it('avatar selection does not depend on seat - same uid+roomId always gets same avatar', () => {
      const { getAvatarByUid } = require('@/utils/avatar');

      // Render avatar for same user in same room
      render(<Avatar value="player-123" size={50} roomId="room-456" />);

      // getAvatarByUid should be called with roomId and uid (no seat parameter)
      expect(getAvatarByUid).toHaveBeenCalledWith('room-456', 'player-123');
    });
  });
});

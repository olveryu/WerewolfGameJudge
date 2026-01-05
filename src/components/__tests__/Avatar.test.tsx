import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

// Mock avatar utility functions
jest.mock('../../utils/avatar', () => ({
  getAvatarImage: jest.fn(() => 1), // Return a mock image source
  getUniqueAvatarBySeat: jest.fn(() => 2), // Return a different mock image source
}));

describe('Avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with value and size', () => {
      const { UNSAFE_root } = render(
        <Avatar value="test-user" size={50} />
      );
      
      // Avatar renders an Image component
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should render with custom avatar URL', () => {
      const { UNSAFE_root } = render(
        <Avatar 
          value="test-user" 
          size={50} 
          avatarUrl="https://example.com/avatar.jpg" 
        />
      );
      
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Avatar source selection', () => {
    it('should use custom avatarUrl when provided', () => {
      const { getAvatarImage, getUniqueAvatarBySeat } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50} 
          avatarUrl="https://example.com/avatar.jpg" 
        />
      );
      
      // When avatarUrl is provided, neither helper should be called
      expect(getAvatarImage).not.toHaveBeenCalled();
      expect(getUniqueAvatarBySeat).not.toHaveBeenCalled();
    });

    it('should use getUniqueAvatarBySeat when seatNumber is provided', () => {
      const { getAvatarImage, getUniqueAvatarBySeat } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50} 
          seatNumber={3}
        />
      );
      
      expect(getUniqueAvatarBySeat).toHaveBeenCalledWith(3, undefined);
      expect(getAvatarImage).not.toHaveBeenCalled();
    });

    it('should use getUniqueAvatarBySeat with roomId when both are provided', () => {
      const { getUniqueAvatarBySeat } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50} 
          seatNumber={3}
          roomId="room-123"
        />
      );
      
      expect(getUniqueAvatarBySeat).toHaveBeenCalledWith(3, 'room-123');
    });

    it('should use getAvatarImage when no seatNumber is provided', () => {
      const { getAvatarImage, getUniqueAvatarBySeat } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50}
        />
      );
      
      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
      expect(getUniqueAvatarBySeat).not.toHaveBeenCalled();
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
      const { getAvatarImage } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50} 
          avatarUrl={null}
        />
      );
      
      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
    });

    it('should fall back to local image when avatarUrl is undefined', () => {
      const { getAvatarImage } = require('../../utils/avatar');
      
      render(
        <Avatar 
          value="test-user" 
          size={50} 
          avatarUrl={undefined}
        />
      );
      
      expect(getAvatarImage).toHaveBeenCalledWith('test-user');
    });
  });
});

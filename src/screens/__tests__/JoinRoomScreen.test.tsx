import React from 'react';
import { render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
import JoinRoomScreen from '../JoinRoomScreen/JoinRoomScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: jest.fn(),
  }),
}));

// Mock useRoom hook
const mockJoinRoom = jest.fn();

jest.mock('../../hooks', () => ({
  useRoom: () => ({
    joinRoom: mockJoinRoom,
    loading: false,
    error: null,
  }),
}));

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('JoinRoomScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render title', () => {
      const { getByText } = render(<JoinRoomScreen />);
      
      expect(getByText('加入房间')).toBeTruthy();
    });

    it('should render subtitle with instructions', () => {
      const { getByText } = render(<JoinRoomScreen />);
      
      expect(getByText('请输入4位数房间号')).toBeTruthy();
    });

    it('should render room number input', () => {
      const { getByPlaceholderText } = render(<JoinRoomScreen />);
      
      expect(getByPlaceholderText('输入房间号')).toBeTruthy();
    });

    it('should render join button', () => {
      const { getByText } = render(<JoinRoomScreen />);
      
      expect(getByText('加入')).toBeTruthy();
    });
  });

  describe('Room Number Input', () => {
    it('should limit input to 4 characters', () => {
      const { getByPlaceholderText } = render(<JoinRoomScreen />);
      
      const input = getByPlaceholderText('输入房间号');
      // The maxLength prop should limit to 4 characters
      expect(input.props.maxLength).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should display error when join fails', () => {
      jest.spyOn(require('../../hooks'), 'useRoom').mockReturnValue({
        joinRoom: mockJoinRoom,
        loading: false,
        error: '房间不存在',
      });

      const { getByText } = render(<JoinRoomScreen />);
      
      expect(getByText('房间不存在')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when joining', () => {
      jest.spyOn(require('../../hooks'), 'useRoom').mockReturnValue({
        joinRoom: mockJoinRoom,
        loading: true,
        error: null,
      });

      const { UNSAFE_getByType } = render(<JoinRoomScreen />);
      
      // Button shows ActivityIndicator when loading
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });
});

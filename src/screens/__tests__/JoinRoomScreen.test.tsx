import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

// Mock SimplifiedRoomService (组件实际使用的 service)
const mockGetRoom = jest.fn();

jest.mock('../../services/SimplifiedRoomService', () => ({
  SimplifiedRoomService: {
    getInstance: () => ({
      getRoom: mockGetRoom,
    }),
  },
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
    /**
     * SKIPPED: fireEvent.changeText on TextInput triggers Button's disabled prop change,
     * which causes TouchableOpacity._opacityInactive animation to fire.
     * This animation path hits react-native-renderer version check and fails due to
     * react (19.2.3) vs react-native-renderer (19.1.0) mismatch.
     *
     * Conditions to re-enable:
     * - Upgrade react-native to version with renderer matching React 19.2.x, OR
     * - Add global jest mock for Animated/TouchableOpacity in jest.setup.ts
     */
    it('should display error when room does not exist', async () => {
      mockGetRoom.mockResolvedValue(null);

      const { getByPlaceholderText, getByText, findByText } = render(
        <JoinRoomScreen />
      );

      fireEvent.changeText(getByPlaceholderText('输入房间号'), '1234');
      fireEvent.press(getByText('加入'));

      expect(await findByText('房间不存在')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    /**
     * SKIPPED: fireEvent.changeText on TextInput triggers Button's disabled prop change,
     * which causes TouchableOpacity._opacityInactive animation to fire.
     * This animation path hits react-native-renderer version check and fails due to
     * react (19.2.3) vs react-native-renderer (19.1.0) mismatch.
     *
     * Conditions to re-enable:
     * - Upgrade react-native to version with renderer matching React 19.2.x, OR
     * - Add global jest mock for Animated/TouchableOpacity in jest.setup.ts
     */
    it('should disable button while joining', async () => {
      mockGetRoom.mockReturnValue(new Promise(() => {}));

      const { getByPlaceholderText, getByText, UNSAFE_getByType } = render(
        <JoinRoomScreen />
      );

      fireEvent.changeText(getByPlaceholderText('输入房间号'), '1234');
      fireEvent.press(getByText('加入'));

      await waitFor(() => {
  // When joining, our Button renders an ActivityIndicator and becomes disabled.
  const spinner = UNSAFE_getByType(ActivityIndicator);
  expect(spinner).toBeTruthy();

  const wrapper = spinner.parent;
  expect(wrapper?.props?.accessibilityState?.disabled).toBe(true);
      });
    });
  });
});

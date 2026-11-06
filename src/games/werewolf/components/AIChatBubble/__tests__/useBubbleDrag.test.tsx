import { act, renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { publishRoomBottomPanelHeight } from '@/features/room/hooks/roomBottomPanelHeight';

import { BUBBLE_HEIGHT, BUBBLE_MARGIN, getDefaultPosition } from '../AIChatBubble.styles';
import { useBubbleDrag } from '../useBubbleDrag';

describe('useBubbleDrag', () => {
  afterEach(() => {
    act(() => publishRoomBottomPanelHeight(null));
  });

  it('keeps the bubble above the focused room bottom panel and restores it when the panel leaves', () => {
    const { width, height } = Dimensions.get('window');
    const { result } = renderHook(() => useBubbleDrag(jest.fn(), 'user-1'));
    const preferredY = getDefaultPosition(width, height).y;
    expect(result.current.position.y).toBe(preferredY);

    act(() => publishRoomBottomPanelHeight(240));
    expect(result.current.position.y).toBe(height - 240 - BUBBLE_HEIGHT - BUBBLE_MARGIN);

    act(() => publishRoomBottomPanelHeight(null));
    expect(result.current.position.y).toBe(preferredY);
  });
});

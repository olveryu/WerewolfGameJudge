import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PlayerGrid } from '@/screens/RoomScreen/components/PlayerGrid';
import { TESTIDS } from '@/testids';

jest.mock('../../../components/Avatar', () => ({
  Avatar: () => null,
}));

/**
 * PlayerGrid Contract Tests
 *
 * PlayerGrid is a PURE UI component. It must:
 * 1. ALWAYS report seat taps to caller (regardless of `disabled` prop)
 * 2. ALWAYS pass through `disabledReason` from seat data
 * 3. Use `disabled` prop ONLY for visual feedback (activeOpacity), not for blocking events
 *
 * All interaction decisions (audio gate, constraint alerts, routing) are
 * handled by SeatTapPolicy in RoomScreen.
 */
describe('PlayerGrid', () => {
  describe('Pure UI contract: always reports seat taps', () => {
    it('calls onSeatPress even when disabled=true (audio gate visual state)', async () => {
      const onSeatPress = jest.fn();

      const seats: any[] = [
        {
          index: 0,
          role: 'villager',
          player: null,
          isMySpot: false,
          isWolf: false,
          isSelected: false,
        },
      ];

      const { findByTestId } = render(
        <PlayerGrid seats={seats} roomNumber="1234" onSeatPress={onSeatPress} disabled />,
      );

      const seat = await findByTestId(TESTIDS.seatTilePressable(0));
      fireEvent.press(seat);

      // Contract: disabled=true does NOT block event reporting
      // SeatTapPolicy decides what to do with the tap
      expect(onSeatPress).toHaveBeenCalledWith(0, undefined);
    });

    it('calls onSeatPress with seat index and undefined disabledReason when disabled=false', async () => {
      const onSeatPress = jest.fn();

      const seats: any[] = [
        {
          index: 0,
          role: 'villager',
          player: null,
          isMySpot: false,
          isWolf: false,
          isSelected: false,
        },
      ];

      const { findByTestId } = render(
        <PlayerGrid seats={seats} roomNumber="1234" onSeatPress={onSeatPress} disabled={false} />,
      );

      const seat = await findByTestId(TESTIDS.seatTilePressable(0));
      fireEvent.press(seat);

      expect(onSeatPress).toHaveBeenCalledWith(0, undefined);
    });
  });

  describe('disabledReason passthrough', () => {
    it('passes disabledReason when seat has constraint violation (disabled=false)', async () => {
      const onSeatPress = jest.fn();

      const seats: any[] = [
        {
          index: 0,
          role: 'villager',
          player: null,
          isMySpot: true,
          isWolf: false,
          isSelected: false,
          disabledReason: '不能选择自己',
        },
      ];

      const { findByTestId } = render(
        <PlayerGrid seats={seats} roomNumber="1234" onSeatPress={onSeatPress} disabled={false} />,
      );

      const seat = await findByTestId(TESTIDS.seatTilePressable(0));
      fireEvent.press(seat);

      expect(onSeatPress).toHaveBeenCalledWith(0, '不能选择自己');
    });

    it('passes disabledReason even when disabled=true (both conditions)', async () => {
      const onSeatPress = jest.fn();

      const seats: any[] = [
        {
          index: 0,
          role: 'villager',
          player: null,
          isMySpot: true,
          isWolf: false,
          isSelected: false,
          disabledReason: '不能选择自己',
        },
      ];

      const { findByTestId } = render(
        <PlayerGrid seats={seats} roomNumber="1234" onSeatPress={onSeatPress} disabled={true} />,
      );

      const seat = await findByTestId(TESTIDS.seatTilePressable(0));
      fireEvent.press(seat);

      // Contract: both disabled=true AND disabledReason are passed through
      // SeatTapPolicy will decide priority (audio gate > disabledReason)
      expect(onSeatPress).toHaveBeenCalledWith(0, '不能选择自己');
    });
  });
});

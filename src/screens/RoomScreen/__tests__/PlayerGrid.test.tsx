import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PlayerGrid } from '../components/PlayerGrid';
import { TESTIDS } from '../../../testids';

jest.mock('../../../components/Avatar', () => ({
  Avatar: () => null,
}));

describe('PlayerGrid', () => {
  it('does not call onSeatPress when disabled=true', async () => {
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

    expect(onSeatPress).not.toHaveBeenCalled();
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

  it('calls onSeatPress with disabledReason when seat has constraint violation', async () => {
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
});
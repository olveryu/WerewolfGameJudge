/**
 * PlayerGrid.stories.tsx - Stories for the real PlayerGrid component
 *
 * This file imports the ACTUAL PlayerGrid component and provides
 * different seat configurations to test various UI states.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PlayerGrid } from './PlayerGrid';
import type { SeatViewModel } from '../RoomScreen.helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Create seat view models
// ─────────────────────────────────────────────────────────────────────────────

const createEmptySeat = (index: number): SeatViewModel => ({
  index,
  role: 'villager',
  player: null,
  isMySpot: false,
  isWolf: false,
  isSelected: false,
});

const createFilledSeat = (
  index: number,
  name: string,
  options: Partial<SeatViewModel> = {},
): SeatViewModel => ({
  index,
  role: 'villager',
  player: {
    uid: `user-${index}`,
    displayName: name,
    avatarUrl: undefined,
  },
  isMySpot: false,
  isWolf: false,
  isSelected: false,
  ...options,
});

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper for proper sizing in Storybook
// ─────────────────────────────────────────────────────────────────────────────

const GridWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={wrapperStyles.container}>{children}</View>
);

const wrapperStyles = StyleSheet.create({
  container: {
    width: 375, // iPhone width
    backgroundColor: '#111827',
    padding: 16,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof PlayerGrid> = {
  title: 'RoomScreen/PlayerGrid',
  component: PlayerGrid,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <GridWrapper>
        <Story />
      </GridWrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlayerGrid>;

// ─────────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────────

export const AllEmpty: Story = {
  name: '全部空位',
  args: {
    seats: Array.from({ length: 8 }, (_, i) => createEmptySeat(i)),
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const AllFilled: Story = {
  name: '全部有人',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '小红'),
      createFilledSeat(2, '小刚'),
      createFilledSeat(3, '小美'),
      createFilledSeat(4, '阿强'),
      createFilledSeat(5, '小丽'),
      createFilledSeat(6, '大壮'),
      createFilledSeat(7, '小芳'),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const PartiallyFilled: Story = {
  name: '部分有人',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createEmptySeat(1),
      createFilledSeat(2, '小红'),
      createEmptySeat(3),
      createEmptySeat(4),
      createFilledSeat(5, '小刚'),
      createEmptySeat(6),
      createFilledSeat(7, '小美'),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const WithMySpot: Story = {
  name: '我的座位（绿边）',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '小红'),
      createFilledSeat(2, '我', { isMySpot: true }),
      createFilledSeat(3, '小刚'),
      createEmptySeat(4),
      createEmptySeat(5),
      createEmptySeat(6),
      createEmptySeat(7),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const WolfMeetingView: Story = {
  name: '🐺 狼人视角 - 看到队友',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '狼1', { isWolf: true, isMySpot: true }),
      createFilledSeat(2, '小红'),
      createFilledSeat(3, '狼2', { isWolf: true }),
      createFilledSeat(4, '小刚'),
      createFilledSeat(5, '小美'),
      createFilledSeat(6, '狼3', { isWolf: true }),
      createFilledSeat(7, '阿强'),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const WolfMeetingWithSelection: Story = {
  name: '🐺 狼人 - 选中目标',
  args: {
    seats: [
      createFilledSeat(0, '小明', { isSelected: true }),
      createFilledSeat(1, '狼1', { isWolf: true, isMySpot: true }),
      createFilledSeat(2, '小红'),
      createFilledSeat(3, '狼2', { isWolf: true }),
      createFilledSeat(4, '小刚'),
      createFilledSeat(5, '小美'),
      createFilledSeat(6, '狼3', { isWolf: true }),
      createFilledSeat(7, '阿强'),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const SeerActionView: Story = {
  name: '🔮 预言家 - 单独行动（不显示狼人）',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '小红'),
      createFilledSeat(2, '预言家', { isMySpot: true }),
      createFilledSeat(3, '小刚'),
      createFilledSeat(4, '小美'),
      createFilledSeat(5, '阿强'),
      createFilledSeat(6, '小丽'),
      createFilledSeat(7, '大壮'),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const AllDisabledDuringAudio: Story = {
  name: '🔇 播放语音 - 全部禁用',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '小红'),
      createFilledSeat(2, '我', { isMySpot: true }),
      createFilledSeat(3, '小刚'),
      createEmptySeat(4),
      createEmptySeat(5),
      createEmptySeat(6),
      createEmptySeat(7),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
    disabled: true,
  },
};

export const SomeSeatsDisabled: Story = {
  name: '🚫 部分禁用（有原因）',
  args: {
    seats: [
      createFilledSeat(0, '小明'),
      createFilledSeat(1, '小红', { disabledReason: '不能选择自己' }),
      createFilledSeat(2, '我', { isMySpot: true, disabledReason: '不能选择自己' }),
      createFilledSeat(3, '狼队友', { isWolf: true, disabledReason: '不能选择狼队友' }),
      createFilledSeat(4, '小刚'),
      createFilledSeat(5, '小美'),
      createEmptySeat(6),
      createEmptySeat(7),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const BlockedPlayerView: Story = {
  name: '😵 被梦魇封锁',
  args: {
    seats: Array.from({ length: 8 }, (_, i) =>
      createFilledSeat(i, `玩家${i + 1}`, {
        isMySpot: i === 2,
        disabledReason: i === 2 ? undefined : '你已被梦魇封锁，无法行动',
      }),
    ),
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const TwelveSeats: Story = {
  name: '12人局',
  args: {
    seats: Array.from({ length: 12 }, (_, i) =>
      i < 10 ? createFilledSeat(i, `玩家${i + 1}`, { isMySpot: i === 5 }) : createEmptySeat(i),
    ),
    roomNumber: '5678',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

export const LongPlayerNames: Story = {
  name: '长名字测试',
  args: {
    seats: [
      createFilledSeat(0, '超级无敌长的名字哈哈'),
      createFilledSeat(1, 'VeryLongEnglishName'),
      createFilledSeat(2, '正常名字'),
      createFilledSeat(3, '🎮游戏玩家🎯'),
      createEmptySeat(4),
      createEmptySeat(5),
      createEmptySeat(6),
      createEmptySeat(7),
    ],
    roomNumber: '1234',
    onSeatPress: (index) => console.log('Seat pressed:', index),
  },
};

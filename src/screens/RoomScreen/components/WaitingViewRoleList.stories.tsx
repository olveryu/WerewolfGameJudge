/**
 * WaitingViewRoleList.stories.tsx - Stories for waiting view role list
 */

import type { Meta, StoryObj } from '@storybook/react';
import { WaitingViewRoleList } from './WaitingViewRoleList';

const meta: Meta<typeof WaitingViewRoleList> = {
  title: 'RoomScreen/WaitingViewRoleList',
  component: WaitingViewRoleList,
  tags: ['autodocs'],
  argTypes: {
    seatIndices: { control: 'object', description: 'Seat indices (0-indexed)' },
  },
};

export default meta;
type Story = StoryObj<typeof WaitingViewRoleList>;

/** Single player waiting */
export const SinglePlayer: Story = {
  args: {
    seatIndices: [2], // Shows as "3号"
  },
};

/** Two players waiting */
export const TwoPlayers: Story = {
  args: {
    seatIndices: [0, 4], // Shows as "1号, 5号"
  },
};

/** Multiple players waiting */
export const MultiplePlayers: Story = {
  args: {
    seatIndices: [1, 3, 5, 7], // Shows as "2号, 4号, 6号, 8号"
  },
};

/** Many players - almost everyone */
export const ManyPlayers: Story = {
  args: {
    seatIndices: [0, 1, 2, 4, 5, 6, 7, 8], // 8 players
  },
};

/** All 12 players waiting */
export const AllPlayers12: Story = {
  args: {
    seatIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
};

/** Empty list - should render nothing */
export const Empty: Story = {
  args: {
    seatIndices: [],
  },
};

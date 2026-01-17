/**
 * BoardInfoCard.stories.tsx - Stories for board configuration display
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BoardInfoCard } from './BoardInfoCard';

const meta: Meta<typeof BoardInfoCard> = {
  title: 'RoomScreen/BoardInfoCard',
  component: BoardInfoCard,
  tags: ['autodocs'],
  argTypes: {
    playerCount: { control: 'number', description: 'Total player count' },
    wolfRolesText: { control: 'text', description: 'Wolf roles description' },
    godRolesText: { control: 'text', description: 'God roles description' },
    specialRolesText: { control: 'text', description: 'Special roles description' },
    villagerCount: { control: 'number', description: 'Villager count' },
  },
};

export default meta;
type Story = StoryObj<typeof BoardInfoCard>;

/** Standard 9-player configuration */
export const Standard9Player: Story = {
  args: {
    playerCount: 9,
    wolfRolesText: '狼人 x2, 狼王 x1',
    godRolesText: '预言家, 女巫, 猎人',
    villagerCount: 3,
  },
};

/** 12-player configuration with more roles */
export const Standard12Player: Story = {
  args: {
    playerCount: 12,
    wolfRolesText: '狼人 x3, 狼王 x1',
    godRolesText: '预言家, 女巫, 猎人, 守卫',
    villagerCount: 4,
  },
};

/** Configuration with special roles */
export const WithSpecialRoles: Story = {
  args: {
    playerCount: 10,
    wolfRolesText: '狼人 x2, 白狼王 x1',
    godRolesText: '预言家, 女巫, 猎人',
    specialRolesText: '混血儿, 盗贼',
    villagerCount: 2,
  },
};

/** Minimal configuration - small game */
export const SmallGame: Story = {
  args: {
    playerCount: 6,
    wolfRolesText: '狼人 x2',
    godRolesText: '预言家, 女巫',
    villagerCount: 2,
  },
};

/** No villagers - all special roles */
export const NoVillagers: Story = {
  args: {
    playerCount: 8,
    wolfRolesText: '狼人 x2, 狼王 x1',
    godRolesText: '预言家, 女巫, 猎人, 守卫, 白痴',
    villagerCount: 0,
  },
};

/** Long role names - test text wrapping */
export const LongRoleIds: Story = {
  args: {
    playerCount: 12,
    wolfRolesText: '普通狼人 x2, 狼王 x1, 白狼王 x1',
    godRolesText: '预言家, 女巫, 猎人, 守卫, 白痴, 石像鬼',
    specialRolesText: '混血儿, 盗贼, 丘比特',
    villagerCount: 1,
  },
};

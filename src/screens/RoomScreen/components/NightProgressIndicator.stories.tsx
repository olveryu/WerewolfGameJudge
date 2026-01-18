/**
 * NightProgressIndicator Stories
 */
import type { Meta, StoryObj } from '@storybook/react';
import { NightProgressIndicator } from './NightProgressIndicator';

const meta: Meta<typeof NightProgressIndicator> = {
  title: 'RoomScreen/NightProgressIndicator',
  component: NightProgressIndicator,
  tags: ['autodocs'],
  argTypes: {
    currentStep: { control: { type: 'number', min: 1, max: 15 } },
    totalSteps: { control: { type: 'number', min: 1, max: 15 } },
    currentRoleName: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof NightProgressIndicator>;

export const Default: Story = {
  args: {
    currentStep: 1,
    totalSteps: 12,
    currentRoleName: '魔术师',
  },
};

export const MidProgress: Story = {
  args: {
    currentStep: 6,
    totalSteps: 12,
    currentRoleName: '女巫',
  },
};

export const NearEnd: Story = {
  args: {
    currentStep: 11,
    totalSteps: 12,
    currentRoleName: '猎人',
  },
};

export const Complete: Story = {
  args: {
    currentStep: 12,
    totalSteps: 12,
    currentRoleName: '黑狼王',
  },
};

export const NoRoleName: Story = {
  args: {
    currentStep: 3,
    totalSteps: 10,
  },
};

export const WolfPhase: Story = {
  args: {
    currentStep: 7,
    totalSteps: 12,
    currentRoleName: '狼人',
  },
};

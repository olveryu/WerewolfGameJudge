/**
 * ActionButton.stories.tsx - Stories for action button with interaction tests
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from 'storybook/test';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionButton } from './ActionButton';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={wrapperStyles.container}>{children}</View>
);

const wrapperStyles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#111827',
    gap: 10,
  },
});

const meta: Meta<typeof ActionButton> = {
  title: 'RoomScreen/ActionButton',
  component: ActionButton,
  decorators: [
    (Story) => (
      <Wrapper>
        <Story />
      </Wrapper>
    ),
  ],
  args: {
    // Default mock for onPress
    onPress: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ActionButton>;

/** Primary button - click triggers onPress */
export const Primary: Story = {
  args: {
    label: '确认',
    disabled: false,
    testID: 'action-button',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('action-button');

    // Click the button
    await userEvent.click(button);

    // Verify onPress was called
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

/** Disabled button - click should NOT trigger onPress */
export const Disabled: Story = {
  args: {
    label: '查看身份',
    disabled: true,
    testID: 'disabled-button',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('disabled-button');

    // Try to click the disabled button
    await userEvent.click(button);

    // Verify onPress was NOT called
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

/** View Role button */
export const ViewRole: Story = {
  args: {
    label: '查看身份',
    disabled: false,
  },
};

/** View Role - waiting for host */
export const ViewRoleWaiting: Story = {
  args: {
    label: '查看身份',
    disabled: true,
  },
};

/** Confirm action */
export const ConfirmAction: Story = {
  args: {
    label: '确认选择',
    disabled: false,
  },
};

/** Skip action */
export const SkipAction: Story = {
  args: {
    label: '跳过',
    disabled: false,
  },
};

/** All states comparison */
export const AllStates: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <ActionButton label="确认" onPress={() => {}} />
      <ActionButton label="查看身份 (等待中)" disabled onPress={() => {}} />
    </View>
  ),
};

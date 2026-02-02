/**
 * ActionButton.stories.tsx - Stories for the generic action button component
 *
 * This tests the button component itself (enabled/disabled states, click behavior).
 * Business-specific labels come from schemas and are tested at higher levels.
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
    onPress: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ActionButton>;

/** Enabled button - click triggers onPress */
export const Enabled: Story = {
  args: {
    label: 'Button Label',
    disabled: false,
    testID: 'action-button',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('action-button');

    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

/** Disabled button - click should NOT trigger onPress */
export const Disabled: Story = {
  args: {
    label: 'Disabled Button',
    disabled: true,
    testID: 'disabled-button',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('disabled-button');

    await userEvent.click(button);
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

/** Visual comparison of enabled vs disabled states */
export const StateComparison: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <ActionButton label="Enabled" onPress={(_meta) => {}} />
      <ActionButton label="Disabled" disabled onPress={(_meta) => {}} />
    </View>
  ),
};

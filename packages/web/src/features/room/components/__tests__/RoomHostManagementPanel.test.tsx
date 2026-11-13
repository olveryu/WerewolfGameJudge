import { render, screen } from '@testing-library/react';

import { RoomHostManagementPanel } from '@/features/room/components/RoomHostManagementPanel';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';

const disabledTaskModel: RoomHostManagementModel = {
  task: { kind: 'action', actionKey: 'assign-roles' },
  sections: [
    {
      key: 'current',
      title: '当前流程',
      actions: [
        {
          key: 'assign-roles',
          label: '分配角色',
          icon: 'people-outline',
          variant: 'primary',
          isEnabled: false,
          disabledReason: '座位尚未坐满（还差 12 人）',
        },
      ],
    },
  ],
};

it('shows the current task reason inside the host-management sheet', () => {
  render(
    <RoomHostManagementPanel model={disabledTaskModel} presentation="sheet" onClose={vi.fn()} />,
  );

  expect(screen.getByRole('button', { name: '分配角色' })).toBeDisabled();
  expect(screen.getByText('座位尚未坐满（还差 12 人）')).toBeVisible();
});

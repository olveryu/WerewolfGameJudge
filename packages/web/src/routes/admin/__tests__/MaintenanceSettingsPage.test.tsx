import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAdminMaintenance, saveAdminMaintenance } from '@/features/admin/services/adminApi';
import { formatMaintenanceEnd } from '@/features/maintenance/maintenance';

import { MaintenanceSettingsPage } from '../pages/MaintenanceSettingsPage';

vi.mock('../AdminShell', () => ({ ThemeToggle: () => null }));
vi.mock('@/features/admin/services/adminApi', () => ({
  fetchAdminMaintenance: vi.fn(),
  saveAdminMaintenance: vi.fn(),
}));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const configuration = {
  enabled: false,
  message: '系统维护中',
  endsAt: null,
};

function mountTab() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MaintenanceSettingsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('maintenance admin editor', () => {
  it('previews the scheduled time and saves it as an absolute instant with the switch', async () => {
    vi.mocked(fetchAdminMaintenance).mockResolvedValue(configuration);
    vi.mocked(saveAdminMaintenance).mockImplementation(async (value) => value);
    mountTab();
    fireEvent.click(await screen.findByRole('checkbox', { name: '开启维护模式' }));
    fireEvent.change(screen.getByLabelText('自动恢复时间'), {
      target: { value: '2099-01-02T09:00' },
    });
    fireEvent.change(screen.getByLabelText('维护说明'), {
      target: { value: '升级服务，明天再见！' },
    });
    const endsAt = new Date('2099-01-02T09:00').toISOString();
    expect(screen.getByText(formatMaintenanceEnd(endsAt))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存维护设置' }));
    await waitFor(() =>
      expect(saveAdminMaintenance).toHaveBeenCalledWith({
        enabled: true,
        message: '升级服务，明天再见！',
        endsAt,
      }),
    );
    expect(await screen.findByText(/维护已开启。新访客立即/)).toBeInTheDocument();
  });

  it('shows a save failure instead of claiming the switch has changed', async () => {
    vi.mocked(fetchAdminMaintenance).mockResolvedValue(configuration);
    vi.mocked(saveAdminMaintenance).mockRejectedValue(new Error('R2 unavailable'));
    mountTab();
    fireEvent.click(await screen.findByRole('checkbox', { name: '开启维护模式' }));
    fireEvent.change(screen.getByLabelText('自动恢复时间'), {
      target: { value: '2099-01-02T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存维护设置' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败：R2 unavailable');
    expect(screen.queryByText(/维护已开启。新访客立即/)).not.toBeInTheDocument();
  });

  it('rejects a past recovery time before saving', async () => {
    vi.mocked(fetchAdminMaintenance).mockResolvedValue(configuration);
    mountTab();
    fireEvent.click(await screen.findByRole('checkbox', { name: '开启维护模式' }));
    fireEvent.change(screen.getByLabelText('自动恢复时间'), {
      target: { value: '2000-01-01T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存维护设置' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('必须晚于当前时间');
    expect(saveAdminMaintenance).not.toHaveBeenCalled();
  });

  it('allows manual disabling even when the previous recovery time has passed', async () => {
    vi.mocked(fetchAdminMaintenance).mockResolvedValue({
      enabled: true,
      message: configuration.message,
      endsAt: '2000-01-01T00:00:00Z',
    });
    vi.mocked(saveAdminMaintenance).mockImplementation(async (value) => value);
    mountTab();
    fireEvent.click(await screen.findByRole('checkbox', { name: '开启维护模式' }));
    fireEvent.click(screen.getByRole('button', { name: '保存维护设置' }));
    await waitFor(() =>
      expect(saveAdminMaintenance).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      ),
    );
  });
});

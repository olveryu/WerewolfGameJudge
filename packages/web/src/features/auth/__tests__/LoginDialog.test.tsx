import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { LoginDialog } from '@/features/auth/LoginDialog';
import { loginRequestStore, requestLogin } from '@/features/auth/loginRequests';

const mocks = vi.hoisted(() => ({
  useAuthContext: vi.fn(),
  useForgotPassword: vi.fn(),
  useResetPassword: vi.fn(),
  useSignInAnonymously: vi.fn(),
  useSignInWithEmail: vi.fn(),
  useSignOut: vi.fn(),
  useSignUpWithEmail: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: mocks.useAuthContext }));
vi.mock('@/features/auth/authMutations', () => ({
  useForgotPassword: mocks.useForgotPassword,
  useResetPassword: mocks.useResetPassword,
  useSignInAnonymously: mocks.useSignInAnonymously,
  useSignInWithEmail: mocks.useSignInWithEmail,
  useSignOut: mocks.useSignOut,
  useSignUpWithEmail: mocks.useSignUpWithEmail,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

function renderLoginDialog() {
  const router = createMemoryRouter([{ path: '/', element: <LoginDialog /> }], {
    initialEntries: ['/'],
  });
  render(<RouterProvider router={router} />);
}

describe('LoginDialog', () => {
  beforeEach(() => {
    loginRequestStore.getSnapshot()?.settle('cancelled');
    vi.clearAllMocks();
    mocks.useAuthContext.mockReturnValue({ user: null, error: null });
    for (const useMutation of [
      mocks.useForgotPassword,
      mocks.useResetPassword,
      mocks.useSignInAnonymously,
      mocks.useSignInWithEmail,
      mocks.useSignOut,
      mocks.useSignUpWithEmail,
    ]) {
      useMutation.mockReturnValue({
        isPending: false,
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      });
    }
  });

  it('labels the sign-up email, password, and optional nickname fields', async () => {
    const user = userEvent.setup();
    const outcome = requestLogin({ title: '注册', startWith: 'emailSignUp' });
    renderLoginDialog();

    expect(screen.getByRole('combobox', { name: '邮箱' })).toBeVisible();
    expect(screen.getByLabelText('密码')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '昵称（可选）' })).toBeVisible();
    expect(screen.getByText('邮箱', { selector: 'label' })).toBeVisible();
    expect(screen.getByText('密码', { selector: 'label' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '返回' }));
    await expect(outcome).resolves.toBe('cancelled');
  });

  it('labels the email, verification code, and new password in password reset', async () => {
    const user = userEvent.setup();
    const outcome = requestLogin({ title: '登录', startWith: 'emailSignIn' });
    renderLoginDialog();

    await user.type(screen.getByRole('combobox', { name: '邮箱' }), 'player@example.com');
    await user.click(screen.getByRole('button', { name: '忘记密码？' }));
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(await screen.findByRole('textbox', { name: '6位验证码' })).toBeVisible();
    expect(screen.getByLabelText('新密码（至少6位）')).toBeVisible();
    expect(screen.getByText('6位验证码', { selector: 'label' })).toBeVisible();
    expect(screen.getByText('新密码（至少6位）', { selector: 'label' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '返回登录' }));
    await user.click(screen.getByRole('button', { name: '返回' }));
    await expect(outcome).resolves.toBe('cancelled');
  });
});

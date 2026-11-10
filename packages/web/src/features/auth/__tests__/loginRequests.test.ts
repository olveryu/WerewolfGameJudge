import { loginRequestStore, requestLogin } from '../loginRequests';

function openLogin() {
  const login = loginRequestStore.getSnapshot();
  if (login === null) throw new Error('No login request is open');
  return login;
}

describe('requestLogin', () => {
  it('withdraws its own dialog when its signal aborts', async () => {
    const controller = new AbortController();
    const outcome = requestLogin({ title: '登录' }, controller.signal);
    const login = openLogin();

    controller.abort();
    login.settle('signedIn');

    await expect(outcome).resolves.toBe('cancelled');
    expect(loginRequestStore.getSnapshot()).toBeNull();
  });

  it('cancels the open request when a newer one supersedes it', async () => {
    const olderController = new AbortController();
    const older = requestLogin({ title: 'older' }, olderController.signal);
    const newer = requestLogin({ title: 'newer' });
    await expect(older).resolves.toBe('cancelled');

    olderController.abort();

    const login = openLogin();
    expect(login.request.title).toBe('newer');
    login.settle('signedIn');
    await expect(newer).resolves.toBe('signedIn');
  });
});

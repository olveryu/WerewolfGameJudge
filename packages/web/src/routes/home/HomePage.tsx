import { useAuthContext } from '@/contexts/AuthContext';

/** Home page. The P1 app shell replaces this with the room entry and game picker. */
export function HomePage() {
  const { user } = useAuthContext();
  return (
    <main>
      <h1>狼人面杀电子裁判助手</h1>
      {user && <p data-testid="home-user-name">{user.displayName ?? '匿名用户'}</p>}
    </main>
  );
}

/** The word library is one unified page per game. Old `?section=` links
 * redirect to it; the agents workspace lives at `/admin/agents/:game`. */
import { isGameWordGame } from '@game-judge/game-engine/product/wordSupply';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { UnifiedLibrary } from '../words/UnifiedLibrary';

/** Unknown game links fail explicitly rather than quietly selecting another inventory. */
export function WordsPage() {
  const { game } = useParams();
  const [parameters] = useSearchParams();
  if (!isGameWordGame(game))
    return (
      <div className="admin-content">
        <h1>未知词库</h1>
        <Link to="/admin/words/fibking" replace>
          返回词库管理
        </Link>
      </div>
    );
  if (parameters.get('section') !== null) {
    const next = new URLSearchParams(parameters);
    next.delete('section');
    const query = next.toString();
    return <Navigate to={`/admin/words/${game}${query === '' ? '' : `?${query}`}`} replace />;
  }
  return <UnifiedLibrary key={game} game={game} />;
}

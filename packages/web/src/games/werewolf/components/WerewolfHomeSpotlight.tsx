/** Werewolf random-role spotlight on Home: flips in a role, 换一个 flips to another, 详情 opens it. */
import './faction.css';
import './WerewolfHomeSpotlight.css';

import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { randomIntInclusive } from '@game-judge/game-engine/platform/random';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { gameGuidePath } from '@/features/navigation/model/gamePaths';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconRefresh from '~icons/ion/refresh';

const FLIP_DURATION = 600;
const AUTO_FLIP_DELAY = 400;
const ROLE_IDS = getAllRoleIds();

function getRoleAt(index: number): RoleId {
  const roleId = ROLE_IDS[index];
  if (roleId === undefined) {
    throw new Error(`[FAIL-FAST] Missing Werewolf Home role at index ${index}`);
  }
  return roleId;
}

function getFactionPresentation(roleId: RoleId) {
  if (isWolfRole(roleId)) return { faction: 'wolf', label: '狼人' } as const;
  const { faction } = getRoleSpec(roleId);
  if (faction === Faction.God) return { faction: 'god', label: '神职' } as const;
  if (faction === Faction.Special) return { faction: 'third', label: '第三方' } as const;
  return { faction: 'villager', label: '村民' } as const;
}

function randomOtherIndex(previous: number): number {
  let next = previous;
  while (next === previous && ROLE_IDS.length > 1) {
    next = randomIntInclusive(0, ROLE_IDS.length - 1);
  }
  return next;
}

/** `intro`: the first, slow flip to the front; `out` / `in`: the half-speed refresh flips. */
type FlipPhase = 'hidden' | 'intro' | 'out' | 'in';

export function WerewolfHomeSpotlight() {
  const navigate = useNavigate();
  const [roleIndex, setRoleIndex] = useState(() => randomIntInclusive(0, ROLE_IDS.length - 1));
  const [phase, setPhase] = useState<FlipPhase>('hidden');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFlippingRef = useRef(false);

  const roleId = getRoleAt(roleIndex);
  const role = getRoleSpec(roleId);
  const faction = getFactionPresentation(roleId);

  useEffect(() => {
    const timers = timersRef.current;
    timers.push(setTimeout(() => setPhase('intro'), AUTO_FLIP_DELAY));
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    };
  }, []);

  const handleRefresh = () => {
    if (isFlippingRef.current) return;
    isFlippingRef.current = true;
    setPhase('out');
    timersRef.current.push(
      setTimeout(() => {
        setRoleIndex(randomOtherIndex);
        setPhase('in');
        timersRef.current.push(
          setTimeout(() => {
            isFlippingRef.current = false;
          }, FLIP_DURATION / 2),
        );
      }, FLIP_DURATION / 2),
    );
  };

  const showsFront = phase === 'intro' || phase === 'in';

  return (
    <section className="werewolf-spotlight" aria-label="今日角色">
      <div className="werewolf-spotlight-flipper" data-phase={phase}>
        <div className="werewolf-spotlight-face werewolf-spotlight-back" aria-hidden={showsFront}>
          <span className="werewolf-spotlight-back-emoji" aria-hidden>
            🐺
          </span>
          <span className="werewolf-spotlight-back-text">猜猜今天是谁？</span>
        </div>

        <div
          className="werewolf-spotlight-face werewolf-spotlight-front"
          aria-hidden={!showsFront}
          inert={!showsFront}
        >
          <div className="werewolf-spotlight-row">
            <img className="werewolf-spotlight-avatar" src={getRoleAvatar(roleId)} alt="" />
            <div className="werewolf-spotlight-info">
              <div className="werewolf-spotlight-name-row">
                <span className="werewolf-spotlight-name">{role.displayName}</span>
                <span className="werewolf-spotlight-badge" data-faction={faction.faction}>
                  {faction.label}
                </span>
              </div>
              <p className="werewolf-spotlight-description">{role.description}</p>
            </div>
          </div>
          <div className="werewolf-spotlight-actions">
            <button type="button" className="werewolf-spotlight-action" onClick={handleRefresh}>
              <IconRefresh aria-hidden />
              换一个
            </button>
            <button
              type="button"
              className="werewolf-spotlight-action"
              data-variant="detail"
              onClick={() =>
                void navigate(
                  `${gameGuidePath('werewolf', null)}?roleId=${encodeURIComponent(roleId)}`,
                )
              }
            >
              详情
              <IconChevronForward aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { NightActions } from '../../__tests__/boards/nightScript';

export interface NightScenario {
  readonly name: string;
  readonly roles: readonly RoleId[];
  readonly choices: NightActions;
  readonly randomSeed?: string;
}

type NamedChoices = readonly [name: string, choices: NightActions];

const VILLAGERS = ['villager', 'villager', 'villager', 'villager'] as const;
const WOLVES = ['wolf', 'wolf', 'wolf'] as const;
const STANDARD = [...VILLAGERS, ...WOLVES, 'wolf', 'seer', 'witch', 'hunter', 'idiot'] as const;
const BLOOD_MOON = [
  ...VILLAGERS,
  ...WOLVES,
  'bloodMoon',
  'seer',
  'witch',
  'idiot',
  'witcher',
] as const;
const DREAM = [
  ...VILLAGERS,
  ...WOLVES,
  'darkWolfKing',
  'seer',
  'witch',
  'hunter',
  'dreamcatcher',
] as const;
const ECLIPSE = [
  ...VILLAGERS,
  ...WOLVES,
  'eclipseWolfQueen',
  'seer',
  'witch',
  'guard',
  'sequencePrince',
] as const;
const GARGOYLE = [
  ...VILLAGERS,
  ...WOLVES,
  'gargoyle',
  'seer',
  'witch',
  'hunter',
  'graveyardKeeper',
] as const;
const GUARD = [
  ...VILLAGERS,
  ...WOLVES,
  'darkWolfKing',
  'seer',
  'witch',
  'hunter',
  'guard',
] as const;
const MAGICIAN = [
  ...VILLAGERS,
  ...WOLVES,
  'darkWolfKing',
  'seer',
  'witch',
  'hunter',
  'magician',
] as const;
const PSYCHIC = [
  ...VILLAGERS,
  ...WOLVES,
  'wolfRobot',
  'psychic',
  'witch',
  'hunter',
  'guard',
] as const;
const PURE_WHITE = [
  ...VILLAGERS,
  ...WOLVES,
  'wolfWitch',
  'guard',
  'witch',
  'hunter',
  'pureWhite',
] as const;
const SEED = [...VILLAGERS, ...WOLVES, 'seedWolf', 'seer', 'witch', 'knight', 'guard'] as const;
const SPIRIT = [
  ...VILLAGERS,
  ...WOLVES,
  'spiritKnight',
  'seer',
  'witch',
  'hunter',
  'guard',
] as const;
const QUEEN = [...VILLAGERS, ...WOLVES, 'wolfQueen', 'seer', 'witch', 'knight', 'guard'] as const;
const ROBOT_SEER = [
  ...VILLAGERS,
  ...WOLVES,
  'wolfRobot',
  'seer',
  'witch',
  'magician',
  'guard',
] as const;
const ROBOT_HUNTER = [
  'villager',
  'villager',
  'villager',
  'hunter',
  ...WOLVES,
  'wolfRobot',
  'seer',
  'witch',
  'guard',
  'psychic',
] as const;
const GIRL = [...VILLAGERS, ...WOLVES, 'wolfGirl', 'seer', 'poisoner', 'hunter', 'guard'] as const;
const AWAKENED = [
  ...VILLAGERS,
  'wolf',
  'wolf',
  'awakenedGargoyle',
  'seer',
  'witch',
  'hunter',
  'guard',
  'graveyardKeeper',
] as const;
const NIGHTMARE = [
  ...VILLAGERS,
  ...WOLVES,
  'nightmare',
  'seer',
  'witch',
  'hunter',
  'guard',
] as const;
const PIPER = [
  'piper',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'guard',
  ...VILLAGERS,
  'villager',
] as const;
const SHADOW = [
  'shadow',
  'avenger',
  'slacker',
  ...WOLVES,
  'seer',
  'witch',
  'guard',
  'villager',
  'villager',
  'villager',
] as const;
const ELDERS = [
  'silenceElder',
  'votebanElder',
  'guard',
  'seer',
  'witch',
  'hunter',
  ...WOLVES,
  'villager',
  'villager',
  'villager',
] as const;
const MIRROR = [
  'villager',
  'villager',
  'villager',
  ...WOLVES,
  'darkWolfKing',
  'seer',
  'mirrorSeer',
  'witch',
  'guard',
  'knight',
] as const;
const DRUNK = [...MIRROR.slice(0, -1), 'drunkSeer'] as const;
const STEP_COVERAGE = [
  'magician',
  'slacker',
  'wildChild',
  'pureWhite',
  'wolfWitch',
  'guard',
  'wolf',
  'wolf',
  'wolfQueen',
  'witch',
  'gargoyle',
  'psychic',
] as const;
const POISONER_COVERAGE = [
  'crow',
  'poisoner',
  'hunter',
  'dreamcatcher',
  'seer',
  ...WOLVES,
  'darkWolfKing',
  'villager',
  'villager',
  'villager',
] as const;

function scenarios(
  board: string,
  roles: readonly RoleId[],
  entries: readonly NamedChoices[],
): readonly NightScenario[] {
  return entries.map(([name, choices]) => ({ name: `${board}: ${name}`, roles, choices }));
}

export const LEGACY_NIGHT_SCENARIOS: readonly NightScenario[] = [
  ...scenarios('standard seer', STANDARD, [
    ['villager', { wolf: 1, seer: 0 }],
    ['wolf', { wolf: 0, seer: 4 }],
    ['skip', { wolf: 0, seer: null }],
    ['witch', { wolf: 0, seer: 9 }],
    ['idiot', { wolf: 0, seer: 11 }],
  ]),
  ...scenarios('intermediate standard night', STANDARD, [
    ['wolf attack and seer check', { wolf: 0, seer: 1 }],
    ['witch saves', { wolf: 0, witch: { save: 0, poison: null }, seer: 1 }],
    ['witch poisons', { wolf: 0, witch: { save: null, poison: 2 }, seer: 1 }],
  ]),
  ...scenarios('blood moon', BLOOD_MOON, [
    ['villager', { wolf: 1, seer: 0 }],
    ['blood moon', { wolf: 0, seer: 7 }],
    ['skip', { wolf: 0, seer: null }],
    ['witcher', { wolf: 0, seer: 11 }],
  ]),
  ...scenarios('dreamcatcher', DREAM, [
    ['dream another', { dreamcatcher: 0, wolf: 1, seer: 4 }],
    ['shelter wolf target', { dreamcatcher: 1, wolf: 1, seer: 4 }],
    ['skip', { dreamcatcher: null, wolf: 0, seer: 4 }],
    [
      'dreamcatcher poisoned',
      { dreamcatcher: 0, wolf: null, witch: { save: null, poison: 11 }, seer: 4 },
    ],
  ]),
  ...scenarios('eclipse wolf queen', ECLIPSE, [
    ['redirect seer', { eclipseWolfQueen: 4, wolf: 0, seer: 4 }],
    ['unaffected seer', { eclipseWolfQueen: 0, wolf: 1, seer: 4 }],
    ['redirect guard', { eclipseWolfQueen: 0, guard: 0, wolf: 0, seer: 4 }],
    [
      'redirect poison',
      { eclipseWolfQueen: 0, wolf: 1, witch: { save: null, poison: 0 }, seer: 4 },
    ],
    ['skip shelter', { eclipseWolfQueen: null, guard: 0, wolf: 0, seer: 4 }],
    ['wolf ignores shelter', { eclipseWolfQueen: 0, wolf: 0, seer: 4 }],
  ]),
  ...scenarios('gargoyle', GARGOYLE, [
    ['villager', { gargoyle: 0, wolf: 1, seer: 4 }],
    ['wolf', { gargoyle: 4, wolf: 0, seer: 5 }],
    ['seer', { gargoyle: 8, wolf: 0, seer: 4 }],
    ['hunter', { gargoyle: 10, wolf: 0, seer: 4 }],
    ['skip', { gargoyle: null, wolf: 0, seer: 4 }],
  ]),
  ...scenarios('guard', GUARD, [
    ['protect attack', { guard: 0, wolf: 0, seer: 4 }],
    ['protect another', { guard: 1, wolf: 0, seer: 4 }],
    ['skip', { guard: null, wolf: 2, seer: 4 }],
    [
      'guard and antidote conflict',
      { guard: 0, wolf: 0, witch: { save: 0, poison: null }, seer: 4 },
    ],
    [
      'guard another, antidote attack',
      { guard: 1, wolf: 0, witch: { save: 0, poison: null }, seer: 4 },
    ],
  ]),
  ...scenarios('magician', MAGICIAN, [
    ['check swapped villager', { magician: { targets: [0, 4] }, wolf: 1, seer: 0 }],
    ['check swapped wolf', { magician: { targets: [0, 4] }, wolf: 1, seer: 4 }],
    ['skip swap', { magician: null, wolf: 0, seer: 4 }],
    ['swapped wolf attack', { magician: { targets: [0, 4] }, wolf: 0, seer: 1 }],
    [
      'swapped poison',
      { magician: { targets: [0, 4] }, wolf: null, witch: { save: null, poison: 4 }, seer: 1 },
    ],
    [
      'both swapped seats die',
      { magician: { targets: [0, 4] }, wolf: 0, witch: { save: null, poison: 4 }, seer: 1 },
    ],
    ['swap wolf king', { magician: { targets: [2, 7] }, wolf: 0, seer: 2 }],
  ]),
  ...scenarios('mirror and drunk seers', MIRROR, [
    ['mirror checks during a complete night', { wolf: 1, seer: 0, mirrorSeer: 0, guard: 0 }],
    ['mirror checks a villager', { wolf: 1, mirrorSeer: 0 }],
    ['mirror checks a wolf', { wolf: 1, mirrorSeer: 3 }],
    ['seer and mirror check a wolf', { wolf: 1, seer: 3, mirrorSeer: 3 }],
  ]),
  ...scenarios('mirror and drunk seers', DRUNK, [
    [
      'drunk checks during a complete night',
      { wolf: 1, seer: 0, mirrorSeer: 0, drunkSeer: 0, guard: 0 },
    ],
  ]),
  {
    name: 'drunk seer: random result is correct',
    roles: DRUNK,
    choices: { wolf: 1, drunkSeer: 0 },
    randomSeed: 'seed-1',
  },
  {
    name: 'drunk seer: random result is inverted',
    roles: DRUNK,
    choices: { wolf: 1, drunkSeer: 0 },
    randomSeed: 'seed-2',
  },
  ...scenarios('psychic', PSYCHIC, [
    ['villager', { wolf: 1, psychic: 0 }],
    ['wolf', { wolf: 0, psychic: 4 }],
    ['wolf robot', { wolf: 0, psychic: 7 }],
    ['skip', { wolf: 0, psychic: null }],
    ['guard', { guard: 0, wolf: 1, psychic: 11 }],
    ['witch', { wolf: 0, psychic: 9 }],
  ]),
  ...scenarios('pure white and wolf witch', PURE_WHITE, [
    ['pure white checks villager', { pureWhite: 0, wolf: 1, guard: 2, wolfWitch: 3 }],
    ['pure white checks wolf', { pureWhite: 4, wolf: 0, guard: 1, wolfWitch: 2 }],
    ['pure white checks wolf witch', { pureWhite: 7, wolf: 0, guard: 1, wolfWitch: 2 }],
    ['pure white checks witch', { pureWhite: 9, wolf: 0, guard: 1, wolfWitch: 2 }],
    ['pure white skips', { pureWhite: null, wolf: 0, guard: 1, wolfWitch: 2 }],
    ['wolf witch checks villager', { wolfWitch: 0, wolf: 1, guard: 2, pureWhite: 3 }],
    ['wolf witch checks pure white', { wolfWitch: 11, wolf: 0, guard: 1, pureWhite: 2 }],
    ['wolf witch checks guard', { wolfWitch: 8, wolf: 0, guard: 1, pureWhite: 2 }],
    ['wolf witch skips', { wolfWitch: null, wolf: 0, guard: 1, pureWhite: 2 }],
  ]),
  ...scenarios('seed wolf', SEED, [
    [
      'convert seer and discard action',
      { guard: 0, wolf: 8, seedWolf: { confirmed: true }, seer: 4 },
    ],
    ['guard blocks infection', { guard: 8, wolf: 8, seedWolf: { confirmed: true }, seer: 4 }],
    ['seer sees converted villager', { guard: 1, wolf: 0, seedWolf: { confirmed: true }, seer: 0 }],
    [
      'seer sees unconverted villager',
      { guard: 0, wolf: 0, seedWolf: { confirmed: true }, seer: 0 },
    ],
    [
      'infection preserves poison',
      {
        guard: 0,
        wolf: 8,
        seedWolf: { confirmed: true },
        witch: { save: null, poison: 8 },
        seer: 4,
      },
    ],
    ['infection skipped', { guard: 1, wolf: 0, seedWolf: { confirmed: false }, seer: 4 }],
    [
      'infected guard loses protection',
      { guard: 1, wolf: 11, seedWolf: { confirmed: true }, seer: 4 },
    ],
    [
      'infected witch loses poison',
      { wolf: 9, seedWolf: { confirmed: true }, witch: { save: null, poison: 0 }, seer: 4 },
    ],
  ]),
  ...scenarios('spirit knight', SPIRIT, [
    ['seer reflected', { wolf: 0, seer: 7 }],
    ['seer checks ordinary wolf', { wolf: 0, seer: 4 }],
    ['witch reflected', { wolf: null, witch: { save: null, poison: 7 }, seer: 4 }],
    ['witch poisons villager', { wolf: null, witch: { save: null, poison: 0 }, seer: 4 }],
    ['wolf attacks villager', { wolf: 0, seer: 1 }],
    ['seer checks villager', { wolf: 1, seer: 0 }],
    ['seer sees spirit knight', { wolf: 0, seer: 7 }],
    ['seer skips', { wolf: 0, seer: null }],
    ['guard protects seer', { guard: 8, wolf: 8, seer: 4 }],
  ]),
  ...scenarios('witch', MAGICIAN, [
    ['save attacked seat', { wolf: 0, witch: { save: 0, poison: null }, seer: 4 }],
    ['no save', { wolf: 1, seer: 4 }],
    ['poison villager', { wolf: null, witch: { save: null, poison: 2 }, seer: 4 }],
    ['poison wolf', { wolf: null, witch: { save: null, poison: 4 }, seer: 5 }],
    ['attacked witch skips', { wolf: 9, seer: 4 }],
    ['witch context and save', { wolf: 0, witch: { save: 0, poison: null }, seer: 4 }],
    ['only attacked target saved', { wolf: 0, witch: { save: 0, poison: null }, seer: 4 }],
    ['skip antidote', { wolf: 0, seer: 4 }],
  ]),
  ...scenarios('wolf queen', QUEEN, [
    ['charm villager', { wolf: 1, wolfQueen: 0, seer: 4 }],
    ['charm seer', { wolf: 0, wolfQueen: 8, seer: 4 }],
    ['skip charm', { wolf: 0, wolfQueen: null, seer: 4 }],
    ['charmed target attacked', { wolf: 0, wolfQueen: 0, seer: 4 }],
    [
      'poisoned queen links target',
      { wolf: null, wolfQueen: 0, witch: { save: null, poison: 7 }, seer: 4 },
    ],
    ['charm and attack different', { wolf: 1, wolfQueen: 0, seer: 4 }],
  ]),
  ...scenarios('wolf robot psychic disguise', PSYCHIC, [
    ['learn villager', { wolfRobot: 0, wolf: 1, psychic: 7 }],
    ['learn wolf', { wolfRobot: 4, wolf: 1, psychic: 7 }],
    ['skip learning', { wolfRobot: null, wolf: 1, psychic: 7 }],
  ]),
  ...scenarios('wolf robot seer disguise', ROBOT_SEER, [
    ['learn villager', { wolfRobot: 0, wolf: 1, seer: 7 }],
    ['learn wolf', { wolfRobot: 4, wolf: 1, seer: 7 }],
    ['skip learning', { wolfRobot: null, wolf: 1, seer: 7 }],
    [
      'swapped robot and villager',
      { wolfRobot: 9, magician: { targets: [7, 0] }, wolf: 1, seer: 0 },
    ],
    ['swapped robot and wolf', { wolfRobot: 0, magician: { targets: [7, 4] }, wolf: 1, seer: 7 }],
  ]),
  ...scenarios('wolf robot hunter gate', ROBOT_HUNTER, [
    [
      'poison robot before learning hunter',
      { wolf: 0, witch: { save: null, poison: 7 }, wolfRobot: 3, seer: 4, psychic: 5 },
    ],
    ['learn hunter without poison', { wolf: 0, wolfRobot: 3, seer: 4, psychic: 5 }],
  ]),
  ...scenarios('wolf girl', GIRL, [
    ['confess villager', { wolfGirl: 0, guard: 8, seer: 0 }],
    ['confess guard', { wolfGirl: 11, guard: 8, seer: 4 }],
    ['confirm confession', { wolfGirl: 0, seer: 4, guard: 8 }],
  ]),
  ...scenarios('awakened gargoyle', AWAKENED, [
    ['convert adjacent villager after prior steps were skipped', { awakenedGargoyle: 3 }],
    ['convert and attack another', { awakenedGargoyle: 3, wolf: 0, seer: 5, guard: 1 }],
    ['confirm conversion', { awakenedGargoyle: 3, wolf: 0, seer: 4, guard: 1 }],
  ]),
  ...scenarios('nightmare', NIGHTMARE, [
    ['block wolf', { nightmare: 4, wolf: null, seer: 4 }],
    ['block itself', { nightmare: 7, wolf: null, seer: 4 }],
    ['block villager', { nightmare: 0, wolf: 1, seer: 4 }],
    ['block guard', { nightmare: 11, wolf: 0, seer: 4 }],
    ['block seer', { nightmare: 8, wolf: 0, seer: null }],
    ['block witch', { nightmare: 9, wolf: 0, seer: 4 }],
    ['skip fear and attack normally', { nightmare: null, wolf: 0, seer: 4 }],
  ]),
  ...scenarios('piper', PIPER, [['hypnotize two seats', { piper: { targets: [3, 5] } }]]),
  ...scenarios('shadow and avenger', SHADOW, [
    ['mimic wolf', { slacker: 3, shadow: 5 }],
    ['bond with avenger', { slacker: 3, shadow: 1 }],
  ]),
  ...scenarios('silence elders', ELDERS, [
    ['silence and reach voting ban', { silenceElder: 3 }],
    ['silence and ban', { silenceElder: 3, votebanElder: 4 }],
  ]),
  ...scenarios('step coverage', STEP_COVERAGE, [
    ['idols and role steps', { slacker: 0, wildChild: 0 }],
  ]),
  ...scenarios('step coverage', POISONER_COVERAGE, [
    ['crow curse with poisoner override', { crow: 1 }],
  ]),
];

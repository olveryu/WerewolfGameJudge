module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'style', 'chore', 'test', 'docs', 'release'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'night',
        'room',
        'config',
        'hooks',
        'theme',
        'e2e',
        'models',
        'services',
        'audio',
        'web',
        'screens',
        'components',
        'auth',
        'tests',
      ],
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
};

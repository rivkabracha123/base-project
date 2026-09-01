module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // Dashboard tests use the requested JavaScript `*.spec.js` convention.
  testRegex: '.*\\.spec\\.(ts|js)$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../../coverage/backend',
  testEnvironment: 'node',
};

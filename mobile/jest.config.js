module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/features/assigned-route/__tests__/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', {presets: ['module:@react-native/babel-preset']}],
  },
};

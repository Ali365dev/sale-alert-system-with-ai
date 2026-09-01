module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  moduleNameMapper: {
    '^@react-native-community/netinfo$': '@react-native-community/netinfo/jest/netinfo-mock.js',
    '^@react-native-clipboard/clipboard$': '@react-native-clipboard/clipboard/jest/clipboard-mock.js',
  },
  // react-native-reanimated and react-native-safe-area-context are both
  // mocked via __mocks__/ (Jest auto-resolves those for any node_modules
  // package, no explicit jest.mock() needed per test file):
  //  - reanimated's own shipped mock still transitively imports the real
  //    native-worklets init chain in this installed version, so it can't be
  //    used directly (see that mock file's header comment).
  //  - safe-area-context's shipped jest mock only sets a `default` export,
  //    which breaks this codebase's named `import { useSafeAreaInsets }` —
  //    Babel's CJS interop won't surface a named export that only exists
  //    nested under `.default`.
  transformIgnorePatterns: [
    'node_modules/(?!(jest-react-native|react-native[^/]*|@react-native[^/]*|@react-navigation|@d11)/)',
  ],
  // The preset's own transform regex omits .jsx (used throughout src/navigation) —
  // extend it rather than replace, so the asset-file transformer stays wired up too.
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve('@react-native/jest-preset/jest/assetFileTransformer.js'),
  },
  // Measured against the whole src/ tree (not just files a test happens to
  // import) so the coverage report honestly shows what's untested, not just
  // 100% of a self-selected subset.
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/__tests__/**'],
};

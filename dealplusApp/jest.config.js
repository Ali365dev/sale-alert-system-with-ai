module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  moduleNameMapper: {
    '^@react-native-community/netinfo$': '@react-native-community/netinfo/jest/netinfo-mock.js',
    '^@react-native-clipboard/clipboard$': '@react-native-clipboard/clipboard/jest/clipboard-mock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-react-native|react-native[^/]*|@react-native[^/]*|@react-navigation|@d11)/)',
  ],
  // The preset's own transform regex omits .jsx (used throughout src/navigation) —
  // extend it rather than replace, so the asset-file transformer stays wired up too.
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve('@react-native/jest-preset/jest/assetFileTransformer.js'),
  },
};

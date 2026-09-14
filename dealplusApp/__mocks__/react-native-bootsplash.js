// Manual Jest mock for react-native-bootsplash — the real package is a
// TurboModule and cannot initialize under Jest (see the package's own
// README testing section). Every screen/test that imports it (e.g.
// SplashScreen.js's BootSplash.hide() call on mount) gets this instead.
module.exports = {
  hide: jest.fn().mockResolvedValue(undefined),
  isVisible: jest.fn().mockReturnValue(false),
  useHideAnimation: jest.fn().mockReturnValue({
    container: {},
    logo: { source: 0 },
    brand: { source: 0 },
  }),
};

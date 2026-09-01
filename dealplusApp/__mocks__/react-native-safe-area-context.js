// Manual Jest mock for react-native-safe-area-context.
//
// The package ships its own jest mock (react-native-safe-area-context/jest/mock),
// but it only sets a `default` export — this codebase imports named exports
// (`import { useSafeAreaInsets } from ...`), and Babel's CJS interop won't
// surface a named export that only exists nested under `.default`, so that
// mock throws "useSafeAreaInsets is not a function" here. Fixed insets are
// enough for rendering/interaction tests, which don't care about real
// device safe-area geometry.
const React = require('react');

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const FRAME = { x: 0, y: 0, width: 320, height: 640 };

// Real Context objects (not just fixed-value hooks) — @react-navigation/elements'
// SafeAreaProviderCompat reads SafeAreaInsetsContext directly via useContext,
// so it needs an actual context, not just a same-named hook.
const SafeAreaInsetsContext = React.createContext(INSETS);
const SafeAreaFrameContext = React.createContext(FRAME);

const SafeAreaProvider = ({ children }) =>
  React.createElement(
    SafeAreaFrameContext.Provider,
    { value: FRAME },
    React.createElement(SafeAreaInsetsContext.Provider, { value: INSETS }, children),
  );

module.exports = {
  SafeAreaProvider,
  SafeAreaView: ({ children }) => children,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  useSafeAreaInsets: () => React.useContext(SafeAreaInsetsContext),
  useSafeAreaFrame: () => React.useContext(SafeAreaFrameContext),
  initialWindowMetrics: { insets: INSETS, frame: FRAME },
};

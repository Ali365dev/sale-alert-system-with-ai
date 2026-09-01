// Manual Jest mock for react-native-reanimated.
//
// The real package (and even its own shipped `react-native-reanimated/mock`)
// initializes native worklets at import time in this project's installed
// version (4.6.0-nightly + react-native-worklets), which throws under Jest's
// mocked native environment — see the comment in
// src/utils/__tests__/stagger.test.js for the exact crash. This replaces
// only the surface this codebase actually imports (checked via a full grep
// of src/) with plain, synchronous React Native primitives — animations
// resolve instantly instead of running, which is what a render/interaction
// test wants: assert the end state, not the tween.
const React = require('react');
const RN = require('react-native');

// Chainable no-op builder covering FadeInDown/FadeOut/LinearTransition/etc.
// Mirrors the real BaseAnimationBuilder's method surface (delay/duration/
// easing/springify/damping/...) so call sites don't need to change, and
// stores the values in case a test wants to assert on them.
function makeBuilder() {
  const builder = {
    delayV: undefined,
    durationV: undefined,
    delay(v) {
      builder.delayV = v;
      return builder;
    },
    duration(v) {
      builder.durationV = v;
      return builder;
    },
    easing() {
      return builder;
    },
    springify() {
      return builder;
    },
    damping() {
      return builder;
    },
    mass() {
      return builder;
    },
    stiffness() {
      return builder;
    },
    energyThreshold() {
      return builder;
    },
    randomDelay() {
      return builder;
    },
    withCallback() {
      return builder;
    },
    withInitialValues() {
      return builder;
    },
    build() {
      return () => ({});
    },
  };
  return builder;
}

const builderFactory = () => makeBuilder();
// Each of these is used as `FadeInDown.delay(...)` (static-style) — a plain
// object with the same chainable methods works for both `Foo.delay(x)` and
// `Foo().delay(x)` call shapes.
const FadeInDown = makeBuilder();
const FadeInUp = makeBuilder();
const FadeIn = makeBuilder();
const FadeOutDown = makeBuilder();
const FadeOutUp = makeBuilder();
const FadeOut = makeBuilder();
const SlideInDown = makeBuilder();
const SlideInUp = makeBuilder();
const SlideOutDown = makeBuilder();
const SlideOutUp = makeBuilder();
const ZoomIn = makeBuilder();
const ZoomOut = makeBuilder();
const LinearTransition = makeBuilder();
const Layout = makeBuilder();

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  cubic: (t) => t,
  poly: () => (t) => t,
  sin: (t) => t,
  circle: (t) => t,
  exp: (t) => t,
  bezier: () => (t) => t,
  in: (fn) => fn,
  out: (fn) => fn,
  inOut: (fn) => fn,
  elastic: () => (t) => t,
  back: () => (t) => t,
  bounce: (t) => t,
  step0: (t) => t,
  step1: (t) => t,
};

// useSharedValue: a plain mutable ref-like object with a `.value` property —
// enough for components that read/write `.value` in effects/callbacks; no
// actual animation runs (with* helpers below just resolve to the target).
function useSharedValue(initial) {
  const ref = React.useRef({ value: initial });
  return ref.current;
}

function useAnimatedStyle(styleFactory) {
  // Real reanimated re-derives this reactively as shared values change on
  // the UI thread; under this mock, shared values don't trigger re-renders,
  // so this just evaluates once per React render — sufficient for
  // assembling `style` props in a render/interaction test.
  return styleFactory();
}

function useAnimatedRef() {
  return React.useRef(null);
}

function useAnimatedScrollHandler(handlers) {
  return typeof handlers === 'function' ? handlers : handlers?.onScroll ?? (() => {});
}

function useDerivedValue(factory) {
  const ref = React.useRef({ value: factory() });
  return ref.current;
}

// with*: no tweening — the target value applies immediately, and any
// callback fires synchronously as "finished".
const withTiming = (toValue, _config, callback) => {
  callback?.(true);
  return toValue;
};
const withSpring = (toValue, _config, callback) => {
  callback?.(true);
  return toValue;
};
const withDelay = (_delayMs, animation) => animation;
const withSequence = (...animations) => animations[animations.length - 1];
const withRepeat = (animation) => animation;
const cancelAnimation = () => {};
const runOnJS = (fn) => fn;
const runOnUI = (fn) => fn;

const createAnimatedComponent = (Component) => Component;

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  FlatList: RN.FlatList,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
  ZoomIn,
  ZoomOut,
  LinearTransition,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
  runOnJS,
  runOnUI,
};

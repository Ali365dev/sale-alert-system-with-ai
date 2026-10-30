// navigationRef/pendingActions are module-level singletons, so each test
// gets a fresh module instance via resetModules — otherwise a queued action
// left over from one test could leak into and fire during another.
import { CommonActions } from '@react-navigation/native';

let NavigationUtil;

const makeReadyContainer = () => ({
  isReady: () => true,
  dispatch: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
});

beforeEach(() => {
  jest.resetModules();
  NavigationUtil = require('../NavigationUtil');
});

test('navigate() dispatches immediately when the container is already ready', () => {
  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;

  NavigationUtil.navigate('DealDetailScreen', { id: '5' });

  expect(container.dispatch).toHaveBeenCalledWith(CommonActions.navigate('DealDetailScreen', { id: '5' }));
});

test('navigate() before the container is ready is queued, not dropped, and fires once flushed', () => {
  // No `.current` assigned — navigationRef.isReady() is false, matching a
  // real cold start where getInitialNotification() can resolve before
  // <NavigationContainer> has mounted.
  NavigationUtil.navigate('BrandDetailScreen', { id: 'nike' });

  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;
  expect(container.dispatch).not.toHaveBeenCalled();

  NavigationUtil.flushPendingNavigation();
  expect(container.dispatch).toHaveBeenCalledWith(CommonActions.navigate('BrandDetailScreen', { id: 'nike' }));
});

test('multiple actions queued before ready are flushed in the order they were called', () => {
  NavigationUtil.navigate('Screen1');
  NavigationUtil.navigate('Screen2');
  NavigationUtil.navigate('Screen3');

  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;
  NavigationUtil.flushPendingNavigation();

  expect(container.dispatch.mock.calls.map((call) => call[0].payload.name)).toEqual(['Screen1', 'Screen2', 'Screen3']);
});

test('flushing an empty queue is a harmless no-op', () => {
  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;
  expect(() => NavigationUtil.flushPendingNavigation()).not.toThrow();
  expect(container.dispatch).not.toHaveBeenCalled();
});

test('resetAndNavigate() is also queued until ready', () => {
  NavigationUtil.resetAndNavigate('OnboardingWelcomeScreen');

  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;
  NavigationUtil.flushPendingNavigation();

  expect(container.dispatch).toHaveBeenCalledWith(
    CommonActions.reset({ index: 0, routes: [{ name: 'OnboardingWelcomeScreen' }] }),
  );
});

test('goBack() is also queued until ready', () => {
  NavigationUtil.goBack();

  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;
  NavigationUtil.flushPendingNavigation();

  expect(container.dispatch).toHaveBeenCalledWith(CommonActions.goBack());
});

test('an action queued and then flushed does not fire again on a second flush', () => {
  NavigationUtil.navigate('Screen1');
  const container = makeReadyContainer();
  NavigationUtil.navigationRef.current = container;

  NavigationUtil.flushPendingNavigation();
  NavigationUtil.flushPendingNavigation();

  expect(container.dispatch).toHaveBeenCalledTimes(1);
});

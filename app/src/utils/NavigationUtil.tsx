import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// navigationRef.isReady() is a plain synchronous boolean, not a Promise — a
// navigate() call issued before <NavigationContainer> has mounted (a cold
// start driven by a tapped push notification is the classic case: the JS
// bundle boots, getInitialNotification() resolves, and this can fire before
// the navigator itself has ever rendered) would otherwise be silently
// dropped. Anything dispatched before we're ready is queued here instead,
// and flushed once Navigation.jsx's onReady fires.
let pendingActions: Array<() => void> = [];

export function flushPendingNavigation() {
  const queued = pendingActions;
  pendingActions = [];
  queued.forEach((run) => run());
}

function runOrQueue(action: () => void) {
  if (navigationRef.isReady()) {
    action();
  } else {
    pendingActions.push(action);
  }
}

export function navigate(routeName: string, params?: object) {
  runOrQueue(() => navigationRef.dispatch(CommonActions.navigate(routeName, params)));
}

export function resetAndNavigate(routeName: string) {
  runOrQueue(() =>
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: routeName }],
      }),
    ),
  );
}

export function goBack() {
  runOrQueue(() => navigationRef.dispatch(CommonActions.goBack()));
}

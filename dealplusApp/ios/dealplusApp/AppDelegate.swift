import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import Firebase
import FirebaseMessaging
import GoogleSignIn
import UserNotifications


@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()

    // Required for FCM on iOS — without APNs registration, messaging().getToken()
    // never yields a device token and the backend never sees platform=ios rows.
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "dealplusApp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Must set before messaging().getToken() — otherwise FCM never binds
    // the device to APNs and TestFlight/production pushes silently fail.
    Messaging.messaging().apnsToken = deviceToken
    #if DEBUG
    let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    print("[APNs] registered device token: \(hex.prefix(16))…")
    #endif
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    // Common causes: missing Push capability, wrong provisioning profile,
    // or aps-environment mismatch (development vs production for TestFlight).
    print("[APNs] registration failed: \(error.localizedDescription)")
  }

  // Show banner/sound/badge while the app is foregrounded (TestFlight users
  // often test with the app open — without this, only the JS toast fires).
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .badge, .sound, .list])
    } else {
      completionHandler([.alert, .badge, .sound])
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }

  /// Required so Google Sign-In can return to the app after the OAuth redirect.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    return false
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

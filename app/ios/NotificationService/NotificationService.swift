import UserNotifications

/// Attaches the push image FCM sends in `fcm_options.image` — iOS shows a
/// text-only banner unless an extension downloads it before display.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard
      let content = bestAttemptContent,
      let options = content.userInfo["fcm_options"] as? [String: Any],
      let urlString = options["image"] as? String,
      let url = URL(string: urlString)
    else {
      contentHandler(request.content)
      return
    }

    URLSession.shared.downloadTask(with: url) { location, response, _ in
      if let location = location,
         let attachment = Self.attachment(from: location, mimeType: response?.mimeType) {
        content.attachments = [attachment]
      }
      contentHandler(content)
    }.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let content = bestAttemptContent {
      contentHandler(content)
    }
  }

  /// Image URLs often have no file extension (CDN asset ids), and iOS picks
  /// the attachment type from the extension — so derive it from the MIME type.
  private static func attachment(from location: URL, mimeType: String?) -> UNNotificationAttachment? {
    let ext: String
    switch mimeType {
    case "image/png": ext = "png"
    case "image/gif": ext = "gif"
    case "image/webp": ext = "webp"
    default: ext = "jpg"
    }
    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(ext)
    do {
      try FileManager.default.moveItem(at: location, to: file)
      return try UNNotificationAttachment(identifier: "image", url: file)
    } catch {
      return nil
    }
  }
}

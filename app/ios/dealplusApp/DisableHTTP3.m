#import <React/RCTHTTPRequestHandler.h>

/// Render/Cloudflare serves HTTP/3 (QUIC). On iOS simulator and some physical
/// devices the QUIC connection stalls, so Axios hits its timeout. We disable
/// HTTP/3 at two levels:
///  1. Session configuration — prevents the session from advertising QUIC support.
///  2. Per-request interceptor — clears assumesHTTP3Capable on each request as a
///     belt-and-suspenders fallback for iOS 15+.
__attribute__((constructor)) static void DealplusDisableHTTP3(void)
{
  // Level 1: custom session configuration
  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration *{
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    // Cloudflare/Render-specific: tell the CDN not to upgrade this session to HTTP/3.
    NSMutableDictionary *headers = [NSMutableDictionary dictionaryWithDictionary:config.HTTPAdditionalHeaders ?: @{}];
    headers[@"CF-HTTP3"] = @"0";
    config.HTTPAdditionalHeaders = headers;
    return config;
  });

  // Level 2: per-request (iOS 15+)
  RCTSetCustomHTTPRequestInterceptor(^NSURLRequest *(NSURLRequest *request) {
    NSMutableURLRequest *mutableRequest = [request mutableCopy];
    if ([mutableRequest respondsToSelector:@selector(setAssumesHTTP3Capable:)]) {
      mutableRequest.assumesHTTP3Capable = NO;
    }
    return mutableRequest;
  });
}

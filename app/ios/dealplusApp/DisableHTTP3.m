#import <React/RCTHTTPRequestHandler.h>

/// The iOS Simulator's HTTP/3 path to the live Render/Cloudflare API never
/// completes (connection dropped or unparseable response), so Axios hits its
/// 15s timeout. Force these requests onto HTTP/2.
__attribute__((constructor)) static void DealplusDisableHTTP3(void)
{
  RCTSetCustomHTTPRequestInterceptor(^NSURLRequest *(NSURLRequest *request) {
    NSMutableURLRequest *mutableRequest = [request mutableCopy];
    if ([mutableRequest respondsToSelector:@selector(setAssumesHTTP3Capable:)]) {
      mutableRequest.assumesHTTP3Capable = NO;
    }
    return mutableRequest;
  });
}

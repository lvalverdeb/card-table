import SwiftUI
import WebKit

/// The bundled page, served to a web view through the custom `cardtable://` scheme so that it gets a
/// proper origin: saved games, the card design and the language then persist in localStorage exactly
/// as they do on the phones, which a plain file:// page would not guarantee.
struct GameView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        config.websiteDataStore = .default()
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.underPageBackgroundColor = NSColor(red: 0x1d / 255, green: 0x4a / 255, blue: 0x3c / 255, alpha: 1)   // felt, so no white flash before the page paints
        web.allowsMagnification = false
        web.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!))
        return web
    }

    func updateNSView(_ view: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }

    /// `Card Table.app/Contents/MacOS/Card Table --smoke` (debug builds) prints the files the page requested and
    /// what it loaded, then exits; `mac/smoke.sh` runs it. That checks the build from a script without screen recording.
    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ web: WKWebView, didFinish navigation: WKNavigation!) {
            #if DEBUG
            guard CommandLine.arguments.contains("--smoke") else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                web.evaluateJavaScript("document.title + ' | ' + document.querySelector('#title').textContent + ' | ' + location.href + ' | keys=' + Object.keys(localStorage).sort().join(',')") { value, error in
                    smoke("loaded: " + (value as? String ?? "error: \(error?.localizedDescription ?? "no result")"))
                    exit(value is String ? 0 : 1)
                }
            }
            #endif
        }
        func webView(_ web: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
        func webView(_ web: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
        private func fail(_ error: Error) {
            #if DEBUG
            if CommandLine.arguments.contains("--smoke") { smoke("load failed: \(error.localizedDescription)"); exit(1) }
            #endif
        }
    }
}

/// Serves files from the app bundle's `dist` folder (the repository's dist/, bundled as a folder reference).
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "cardtable"

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url,
              let base = Bundle.main.url(forResource: "dist", withExtension: nil) else {
            smokeLog("no dist folder in bundle: \(Bundle.main.resourcePath ?? "?")")
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        smokeLog("request \(url)")
        var path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        if path.hasSuffix("/") { path += "index.html" }
        let file = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(base.standardizedFileURL.path),           // never leave the bundle folder
              let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let response = URLResponse(url: url, mimeType: Self.mime(for: file.pathExtension),
                                   expectedContentLength: data.count, textEncodingName: "utf-8")
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func smokeLog(_ m: String) { smoke("scheme: " + m) }

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html"
        case "css": return "text/css"
        case "js": return "text/javascript"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "png": return "image/png"
        case "svg": return "image/svg+xml"
        case "json": return "application/json"
        default: return "application/octet-stream"
        }
    }
}

/// Debug smoke mode (`--smoke`): prints each step to stdout; `mac/smoke.sh` reads it.
func smoke(_ line: String) {
    #if DEBUG
    if CommandLine.arguments.contains("--smoke") { print("smoke: " + line); fflush(stdout) }
    #endif
}

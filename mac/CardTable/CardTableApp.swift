import SwiftUI

/// Card Table for the Mac: one resizable window holding the web page, with the standard menu bar
/// (Quit, Close, Minimise, full screen) that the SwiftUI app life cycle provides.
@main
struct CardTableApp: App {
    var body: some Scene {
        WindowGroup("Card Table") {
            GameView()
                .frame(minWidth: 720, minHeight: 540)
        }
        .defaultSize(width: 1100, height: 760)
        .commands {
            CommandGroup(replacing: .newItem) {}        // one table is enough; no File > New
        }
    }
}

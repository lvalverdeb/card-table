# Card Table

Six classic card games on one quiet green table: Klondike, FreeCell, Rummy, Hearts, Crazy Eights and Sevens. Everything lives in a single `index.html` with no build step and no dependencies, runs fully offline, and is available in English, Spanish and French.

**Play it:** https://lvalverdeb.github.io/card-table/ in any modern browser, or open `index.html` locally, or install the packaged app for Android and iOS (see below).

## Games

| Game | Players | In short |
|---|---|---|
| Klondike | 1 | The classic solitaire. Draw 1 or Draw 3, Standard or Vegas scoring, undo, Finish for me. |
| FreeCell | 1 | Every card face up, four free cells. Almost every deal can be won. |
| Rummy | You + 1 to 3 | Draw, meld sets and runs, empty your hand. First to 100 points. |
| Hearts | You + 3 | Take tricks, dodge the hearts and the queen of spades. |
| Crazy Eights | You + 1 to 3 | Match suit or rank; eights are wild. |
| Sevens | You + 1 to 3 | Lay cards outward from the sevens. |

Five card designs including a large-print deck, gentle sound effects, a How to play panel for every game, and saved games that resume where you left off.

## Repository

| Path | What it is |
|---|---|
| `index.html` | The whole app: markup, styles and the six games |
| `fonts/` | Instrument Sans and Young Serif (SIL Open Font License) |
| `test/` | Playwright checklist (`cd test && npm install && npm test`), emulator and simulator scripts, store screenshot renderer |
| `android/`, `ios/` | Capacitor projects for Google Play and the App Store (`npm install`, then `npm run sync`) |
| `assets/` | Source icon and splash images |
| `store/` | Google Play listing kit: graphics, screenshots, listing text, privacy policy, console walkthrough |
| `BUILD_GUIDE.md` | How the code is organised, how to test it and how to package it |

Signing keys are not in the repository. `android/keystore.properties` and the keystore it names must be created locally before a release build.

## Licence

Game code © Luis Valverde Badilla, San José, Costa Rica. Fonts under the SIL Open Font License 1.1 (`fonts/LICENSE.txt`). Built with Capacitor (MIT).

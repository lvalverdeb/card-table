# Card Table: Technical Build Guide for VS Code

Nov 12, 2026 · @Luis

The app, now called Card Table, holds six games (Klondike, FreeCell, Rummy, Crazy Eights, Hearts and Sevens) in one self-contained `index.html` (HTML, CSS and JavaScript, no build step and no dependencies) that runs in any modern browser on Windows, Linux, Unix, macOS, iOS and Android. This guide explains how to set it up in VS Code, how the code is organised, and how to package it as an installable desktop and mobile app.

## Prerequisites

The game itself needs only VS Code and a browser. Node.js is needed only for the packaging steps at the end.

| Tool | Needed for | Notes |
| --- | --- | --- |
| VS Code | Editing and debugging | Any recent version |
| Live Server extension (`ritwickdey.LiveServer`) | Serving the page locally with auto-reload | Install from the Extensions view |
| Chrome, Edge or Firefox | Running and debugging | Chrome or Edge work with the built-in VS Code JavaScript debugger |
| Node.js LTS | Packaging only (Tauri, Capacitor) | Not needed to play or develop |
| Rust toolchain | Tauri desktop builds only | Installed with `rustup` |
| Android Studio, Xcode | Capacitor mobile builds only | Xcode requires a Mac |

Optional extensions: ESLint (`dbaeumer.vscode-eslint`) and Prettier (`esbenp.prettier-vscode`).

## Project setup

Create a folder, put the game file in it, and open the folder in VS Code (File > Open Folder).

```text
klondike/
  index.html            all six games: markup, styles, script
  fonts/                the two typefaces as local woff2 files (Open Font License)
  test/                 scripted run of the test checklist (optional, needs Node.js)
  .vscode/
    launch.json         browser debug configuration
    extensions.json     recommended extensions
    settings.json       Live Server port
```

`.vscode/extensions.json`:

```json
{
  "recommendations": ["ritwickdey.LiveServer", "dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
```

`.vscode/settings.json`:

```json
{
  "liveServer.settings.port": 5500,
  "editor.tabSize": 2
}
```

The single-file layout is deliberate: there is nothing to install, bundle or deploy. If the project grows, split it into `index.html`, `styles.css` and `game.js` without changing any logic.

## Architecture

The page loads nine scripts in order: shared helpers, Klondike, Rummy, Sevens, helpers for the newer games, Crazy Eights, Hearts, FreeCell, and a boot script (see Menu and shared code below). The Klondike script is wrapped in an immediately invoked function, organised as seven sections that share a single state object `S`. Every action follows the same path: change `S`, then call `after()`, which redraws, updates the stats, saves, and checks for a win.

| Section | Owns | Key functions |
| --- | --- | --- |
| Sound | Web Audio context and the effect library | `audio`, `unlock`, `play`, `noise`, `tone`, `sfx` |
| Elements | The 52 card elements and 13 empty-pile slots, created once | `mkSlot`, the card loop |
| State | Dealing, saving, validating, undo history | `deal`, `snapshot`, `save`, `valid`, `pushHistory` |
| Layout | Card size and every card's position | `measure`, `layout`, `place`, `relayout`, `dealIn` |
| Rules | Legal moves and the actions that change state | `locate`, `grab`, `canFound`, `canTab`, `doMove`, `draw`, `tap`, `undo`, `finish` |
| Pointer input | Tap and drag for mouse, touch and pen | `pointerdown` / `pointermove` / `endDrag`, `dropTarget` |
| Chrome | Buttons, stats, timer, win screen, cascade | `updateUI`, `newDeal`, `restart`, `setDraw`, `celebrate`, `showWin` |

The page structure is three rows in a column flexbox: a header with the stats, a `main` element holding the felt, and a footer with the controls. `html` and `body` are set to `height: 100%` so the felt fills whatever space the device gives it.

## Game state and rules

A card is an integer from 0 to 51, and everything about it is derived from that number. The whole game is one plain object, so saving and undo are both a `JSON.stringify` call.

```js
const suit = id => Math.floor(id / 13);   // 0 spades, 1 hearts, 2 diamonds, 3 clubs
const rank = id => id % 13 + 1;           // 1 = Ace ... 13 = King
const red  = id => suit(id) === 1 || suit(id) === 2;

S = {
  stock: [],                 // face-down draw pile, top card last
  waste: [],                 // drawn cards, top card last
  found: [[], [], [], []],   // four foundations, Ace upward
  tab:   [[], [], [], [], [], [], []],   // seven tableau columns
  up:    Array(52).fill(false),          // up[id] is true when the card is face up
  score: 0,
  moves: 0
};
```

**Dealing.** `deal()` shuffles the 52 ids with Fisher-Yates, deals 1 to 7 cards into the columns, turns each column's last card face up, and leaves the other 24 cards in the stock. The opening state is kept as a string in `first` so Restart can replay the same deal. Deals are random, so some cannot be won.

**Legal moves.** Two functions hold all the rules:

```js
function canFound(id, f) {            // onto foundation f
  const p = S.found[f];
  if (!p.length) return rank(id) === 1;
  return suit(top(p)) === suit(id) && rank(id) === rank(top(p)) + 1;
}
function canTab(id, c) {              // onto tableau column c
  const col = S.tab[c];
  if (!col.length) return rank(id) === 13;
  const t = top(col);
  return S.up[t] && red(t) !== red(id) && rank(t) === rank(id) + 1;
}
```

`grab(id, loc)` decides what can be picked up: the top waste card, the top card of a foundation, or any face-up tableau card together with every card on top of it. Only a single card can go to a foundation.

**Actions.** `doMove(from, count, to)` is the only function that moves cards between piles. It pushes the current state onto the undo history, moves the cards, turns over a newly exposed tableau card, and updates score and move count. `draw()` turns 1 or 3 cards from the stock, or flips the waste back into the stock when the stock is empty. `tap(id)` picks the best destination for a tapped card: a foundation first, then a non-empty column, then an empty column.

**Scoring.**

| Event | Points |
| --- | --- |
| Card to a foundation | +10 |
| Waste to tableau | +5 |
| Turning a tableau card face up | +5 |
| Foundation back to tableau | -15 (never below 0) |
| Recycling the stock | 0 (no penalty) |

**Undo.** `history` is an array of up to 300 serialised states. `undo()` pops the last one and redraws.

**Auto-finish and winning.** When the stock and waste are empty and every tableau card is face up, the Finish button appears and `finish()` plays the remaining cards to the foundations one every 70 ms. The game is won when all four foundations hold 13 cards.

## Rendering and layout

The 52 cards are DOM elements created once and never destroyed. `layout()` reads the state and gives every card a position with a CSS `transform`, so any change of pile animates for free through a 200 ms transition.

**Card markup.** Each card is an outer `.card` (positioned by `transform`), an `.inner` (rotated 180 degrees on the Y axis when the card is face down), and two children with `backface-visibility: hidden`: the `.face` and the `.back`. Toggling the `down` class flips the card. Suits are Unicode characters followed by the variation selector `U+FE0E`, which stops phones from rendering them as colour emoji. No image files are used.

**Responsive sizing.** `measure()` picks one number, the card width, and everything else follows from it:

```js
const gap = Math.max(4, Math.min(14, availW * 0.012));
let cw = Math.min(112, (availW - 6 * gap) / 7, availH / 4.4);   // fit 7 columns, cap at 112 px
cw = Math.max(34, Math.floor(cw));
const ch = Math.round(cw * 1.4);
```

The width is published as the CSS variable `--cw`. Card height, corner radius and font size are all `calc()` expressions of it, so the same code draws a 112 px card on a desktop and a 45 px card on a phone. A `ResizeObserver` on the play area calls `relayout()` on rotation or window resize.

**Pile positions.**

| Pile | Position | Fan |
| --- | --- | --- |
| Stock | Column 0, top row | Up to 4 px of vertical offset to suggest thickness |
| Waste | Column 1, top row | Top 3 cards fanned sideways by 28% of card width in Draw 3; top card only in Draw 1 |
| Foundations | Columns 3 to 6, top row | Stacked |
| Tableau | Columns 0 to 6, second row | Downward: 27% of card height per face-up card, 12% per face-down card |

When a tableau column would run past the bottom of the screen, its fan is compressed to as little as 60% of normal. Beyond that the play area scrolls vertically.

**Stacking order.** Each card's `z-index` is its index in its pile, set through the `--z` variable. A card that changes position gets the `lift` class for 280 ms (+1000) so it flies above the piles it crosses. A dragged card gets `drag` (+2000, no transition).

**Deal and win animations.** `dealIn()` places every card on the stock without a transition, then lays out the tableau with a 22 ms stagger per card using the `--d` delay variable. `celebrate()` draws the winning cascade on a `canvas` overlay: cards leave the foundations King first, bounce under gravity, and are painted without clearing so they leave trails. Both are skipped when the system setting `prefers-reduced-motion` is on.

## Input

One set of Pointer Events handlers on the board covers mouse, touch and pen, so there is no separate mobile code path.

1. `pointerdown` on a card records the card, its pile, the cards that would move with it, and the start coordinates. The board captures the pointer so later events arrive even if the finger leaves the card.
2. `pointermove` does nothing until the pointer has travelled 6 px. Past that threshold the gesture becomes a drag and the cards follow the pointer.
3. `pointerup` without a drag is a tap and calls `tap(id)`. After a drag it calls `dropTarget()`.
4. `pointercancel` (for example an incoming call) returns the cards to where they were.

`dropTarget()` compares the dragged card's rectangle with every legal destination and picks the one with the largest overlap. The whole length of a tableau column counts as its drop area, so drops do not need to be precise on a small screen. An illegal drop returns the cards to their pile.

Three CSS details make touch work:

- `touch-action: none` on `.card` stops the browser from scrolling or zooming while a card is dragged.
- `user-select: none` on `body` stops long-press text selection.
- Buttons have a minimum height of 42 px for finger targets.

Keyboard shortcuts: Ctrl+Z or Cmd+Z (or `u`) to undo, Space (or `d`) to draw. The cards themselves cannot yet be played from the keyboard.

## Sound

Every effect is synthesised at run time with the Web Audio API, so the project ships no audio files. Two building blocks produce all of them: `noise()` plays a short burst of filtered white noise (the card sounds), and `tone()` plays an oscillator note (the chimes).

| Effect | Trigger | Recipe |
| --- | --- | --- |
| `place` | Card lands on the tableau | 60 ms band-pass noise at 1.6 kHz plus a 170 Hz thump |
| `home` | Card lands on a foundation | Noise snap plus a triangle note that rises one semitone per rank from 440 Hz |
| `draw` | Stock tapped | High-pass swish then a snap |
| `flip` | Tableau card turns face up | 50 ms high-pass noise, delayed 100 ms |
| `recycle` | Waste turned back into stock | 200 ms noise at 1.2 kHz |
| `undo` | Undo | 70 ms noise at 900 Hz |
| `nope` | Tap with no legal move | 130 Hz triangle thud |
| `shuffle` | New deal | 12 noise bursts 45 ms apart |
| `win` | Game won | Five-note rising arpeggio from C5 |

All effects route through a master gain (1.6) and a compressor before the speakers.

**Unlocking audio.** Browsers refuse to start audio until the user interacts with the page. `unlock()` therefore runs in the capture phase of every `pointerdown`, `pointerup`, `mousedown`, `touchstart`, `touchend`, `click` and `keydown`. It creates the `AudioContext` on first use and calls `resume()` if the context is suspended. `play()` waits for that resume to finish before scheduling a sound, so the first effect is not lost.

**iPhone and iPad.** The hardware ring switch mutes Web Audio by default. The code sets `navigator.audioSession.type = 'playback'` where that API exists, and otherwise starts a silent looping `Audio` element built from a generated WAV, which moves the page into the playback category.

**The Sound button.** The choice is stored under the key `klondike-v1-sound`. The label reports the real state: "Sound on" (context running), "Tap for sound" (context still suspended), "Sound unavailable" (no Web Audio support), or "Sound off".

## Menu and shared code

The six games live in one page as seven `section.screen` elements (`s-menu` plus one per game), of which only one is visible. `App.show(name)` switches screens, updates the header title, and calls the `leave()` and `enter()` hooks each game registers in `App.games`. The current screen is mirrored in the URL hash (`#rummy`) and remembered under the storage key `cardtable-screen`. Klondike registers the same hooks as the other games: `enter()` re-fits the board and plays the opening deal animation, which is deferred because the screen is hidden at boot, and `leave()` cuts a running win cascade straight to the result panel. Klondike also has an About panel with its rules, scoring and keyboard shortcuts; while it is open, shortcuts are ignored and the timer pauses.

**Vegas scoring.** A Vegas toggle button sits beside Draw 1 / Draw 3. In Vegas each deal starts at −$52 and the score is recomputed after every move as $5 per foundation card minus the ante, so taking a card back off a foundation simply gives the $5 back. The stock allows one pass in Draw 1 and three in Draw 3, counted in `S.passes`; once they are used and the stock is empty, the slot gets the `dead` class and shows a dimmed, dashed card with an ✕ (`aria-disabled`), and refuses to turn the waste over, and Finish for me never appears while cards remain in the waste. `bank` carries across deals: `bankDeal()` adds the current deal's score to it before Restart, New deal and a mode change, except for a deal with no moves, which is free. In Vegas the header's Score stat becomes Bank and shows the running total including the current deal, as a signed dollar amount; the win panel shows both the deal's result and the bank. Reset bank, shown only in Vegas, sets `bank` to 0 and leaves the deal in play. Below 820px the two footer groups flow as one run of buttons (`display:contents`) so the rows pack tightly, and below 420px the buttons and header stats shrink slightly; the English Klondike footer then fits in two rows on a phone in both modes, and the longer Spanish and French labels take three. Changing mode starts a fresh deal because the two scoring rules differ from the first card. Undo is allowed in both modes.

**Card designs.** The menu offers five designs: Classic, Midnight, Meadow, Cascade and Large print. Cascade takes its colours from the Klondike win cascade: the felt gradient under a brass lattice, with a brass border. `setDeck(name)` writes the choice to a `data-deck` attribute on `<html>` and to the storage key `cardtable-deck`. All card styling reads CSS variables for the back colour, pattern, pattern size and border, the face colour, and the index and centre pip sizes. Their Classic values live in one rule that applies to both `:root` and `[data-deck="classic"]`, and each other design is one rule overriding some of them, so every game and both card renderers follow it with no script changes. Large print enlarges the corner indices. The selectors match `[data-deck]` on any element, which is how each picker button shows a live preview of its own design regardless of the page's current one; that is also why Classic needs its explicit rule. To add a design, add one CSS rule, its name to the `DECKS` list, and a button on the menu.

**About panels.** One `#about` overlay outside the screens serves every game. Each footer has an About button (`data-act="about"`); `openAbout(game)` fills the panel from `LANGS.<lang>.about.<game>` (an intro, the how-to-play list and, for Klondike, scoring and keyboard sections), followed by the device note and the credit line in `CREDIT`. Escape, the Close button and a screen change close it; Klondike pauses its timer while it is open.

**Languages.** The page is in English, Latin American Spanish and French. English is written once: static text stays in the HTML, marked `data-i18n="key"` (`data-i18n-label` for an `aria-label`), and `setLang` reads it from the page on first run; text built in JavaScript lives under `LANGS.en`. `LANGS.es` and `LANGS.fr` translate both sets under the same keys, plus the suit and rank words and the seat names. `t(key, args)` returns the current language's string with `{x}` placeholders filled; `tp(S, p, key, args)` words a message about player `p`, using the `_you` form of the key for the player's own seat; `plural(key, n)` picks the `_1` or `_n` form. A game's status message is stored in its state as `[key, args]` parts and worded by `said(S)` at render time, so a saved game follows a later language change (a save from before this change holds a plain string, which is shown as is). `SUIT_WORDS`, `RANK_WORDS` and `SEATS` are refilled in place on a switch because running games hold references to them. The picker on the menu writes the storage key `cardtable-lang`; without one, the browser's language list picks the first of the three. The card faces keep the A, J, Q, K indices in every language. To add a language, copy the `fr` entry, translate it, and add a `data-lang` button beside the others.

The first script holds everything the games share:

| Shared piece | Purpose |
| --- | --- |
| Sound block (`sfx`, `unlock`, `soundLabel`) | Moved out of Klondike so all games use the same effects and one Sound setting |
| Card constants (`SUITS`, `RANKS`, `SUIT_WORDS`, `RANK_WORDS`) | Defined once here; Klondike aliases them under its older names |
| `cSuit`, `cRank`, `cRed`, `cName`, `cWords` | Card id helpers, the same 0 to 51 numbering as Klondike |
| `cardHTML(id, cls, tag, extra)`, `backHTML` | Build a static card as an HTML string, as a `div`, `span` or `button` |
| `shuffleInPlace(arr)`, `shuffled()` | The one Fisher-Yates shuffle, and a shuffled 52-card deck built with it |
| `seatsHTML`, `setFan` | The row of player seats, and the overlap of a fanned hand |
| `handHTML`, `resultHTML`, `setOverlay` | The player's fanned hand, the round-result panel, and the overlay toggle that rebuilds only when its mode changes. Every multi-player game and FreeCell use these |
| `loadKey`, `saveKey`, `wait` | Storage wrappers and a promise-based delay |

Rummy and Sevens render differently from Klondike. Klondike keeps 52 permanent elements and animates them. The two new games rebuild their HTML from state on every change in a `render()` function, which is simpler and enough for turn-based play. Card size is recomputed in `render()` from the screen's width and height and published as `--cw` and `--ch`.

**Computer players.** Both games use the same loop: while it is not your turn, wait about 0.7 seconds, make one computer action, redraw, save. A `token` counter cancels the loop when you leave the screen or start a new game, and the loop restarts from the saved state when you return.

**Number of players.** Each game's footer has an Opponents control for 1, 2 or 3 computer players. The choice is held in an `opp` variable per game, and the state records the table as `S.n` (players including you) and `S.names`, taken from the shared `SEATS` map: North alone; West and East; or West, North and East. Every turn advance is `(p + 1) % S.n`. Changing the number starts a new game and resets that game's scores.

| Opponents | Rummy deal | Sevens deal |
| --- | --- | --- |
| 1 | 10 cards each | 26 cards each |
| 2 | 7 cards each | 18, 17 and 17 cards |
| 3 | 7 cards each | 13 cards each |

In Sevens a hand of more than 14 cards is drawn as two overlapping rows so it still fits a phone.

## Rummy

Basic Rummy for you and one to three computer players, 7 cards each (10 each with a single opponent), one card turned up to start the discard pile. Rounds are scored and the first player to 100 points wins the match.

```js
S = {
  hands: [[], [], [], []],      // hands[0] is yours
  stock: [], discard: [],
  melds: [{ cards: [] }],       // melds on the table, shared by everyone
  turn: 0,                      // whose turn
  phase: 'draw',                // 'draw' then 'play'
  taken: -1,                    // card taken from the discard pile this turn
  totals: [0, 0, 0, 0], rounds: 0, recycles: 0,
  over: false, winner: -1, won: 0, matchOver: false, msg: ''
};
```

**Rules implemented.**

- A turn is: draw one card from the stock or the top of the discard pile, optionally meld and lay off, then discard one card.
- A set is 3 or 4 cards of one rank (`isSet`). A run is 3 or more consecutive cards of one suit (`isRun`). The Ace is low only, so A-2-3 is a run and Q-K-A is not.
- Laying off adds cards to any meld on the table, whoever laid it down. It is valid when the meld plus the new cards is still a meld.
- A card taken from the discard pile cannot be discarded in the same turn, unless it is the last card in the hand.
- A player goes out by emptying their hand, with or without a final discard.
- The winner scores the pip value of every card left in the other hands: face cards 10, Aces 1, others their number.
- When the stock runs out the discard pile is turned over to form a new stock, at most twice per round. After that the round ends with no score.

**Your controls.** Tap the stock or the discard pile to draw. Tap hand cards to select them. Meld lays the selection down as a new meld, tapping a meld on the table lays the selection off onto it, and Discard discards a single selected card. Sort switches the hand between rank order and suit order.

**Computer strategy (`aiStep`).** One action per tick: take the discard if it completes a meld with two hand cards or fits a table meld, otherwise draw from the stock; lay down the longest meld found by `findMeld`; lay off any card that fits; then discard the card `pickDiscard` scores as least connected to the rest of the hand, preferring to shed high cards.

## Sevens

Sevens (also called Fan Tan) for you and one to three computer players. All 52 cards are dealt as evenly as the table allows.

```js
S = {
  hands: [[], [], [], []],
  lo: [0, 0, 0, 0],             // lowest rank played in each suit, 0 = suit not started
  hi: [0, 0, 0, 0],             // highest rank played in each suit
  empty: true,                  // nothing played yet
  turn: 0, over: false, winner: -1,
  totals: [0, 0, 0, 0], rounds: 0, msg: ''
};
```

**Rules implemented.**

- The player holding the 7 of diamonds starts and must play it.
- On each turn a player plays one card: any 7, or the next card below the lowest or above the highest card already down in that suit. `playable(id)` is the whole rule.
- A player who can play must play. A player who cannot play passes.
- The first player to empty their hand wins the round. Every card left in another hand is one penalty point for its holder, and the lowest running total leads.

**Layout.** Each suit is a row with 13 fixed positions from Ace to King, so the 7 sits in the middle and the row grows outward both ways. Cards overlap so that all 13 fit on a phone. Your playable cards are raised and the rest are dimmed.

**Computer strategy (`aiMove`).** Among its playable cards, a computer player prefers the one that unlocks the most of its own cards further along the same suit, and avoids plays that only help the others.

## Crazy Eights

Crazy Eights for you and one to three computer players, using the same Opponents control as Rummy and Sevens. Each player gets 5 cards (7 with a single opponent). The first to 200 points wins the match.

**Rules implemented.**

- Play a card that matches the suit or the rank of the top discard. `playable(c)` is the whole rule: an eight, the current suit `S.suit`, or the top card's rank.
- An eight can be played on anything, and its player calls the suit that must follow. You choose from a four-button panel; `S.choosing` holds the eight while the panel is open.
- The starter card is never an eight.
- Once per turn you may draw one card from the stock (`S.drew`). After drawing you may play or pass. You cannot pass before drawing.
- When the stock runs out, the discard pile below its top card is shuffled into a new stock. If every player passes in a row with nothing left to draw, the round ends with no score.
- The winner scores the cards left in the other hands: eights 50, face cards 10, Aces 1, others their number.

**Computer strategy (`aiStep`).** Play a non-eight from its longest suit when it can, save eights for when nothing else fits and then call its longest suit, otherwise draw once and pass.

## Hearts

Classic four-player Hearts: you against West, North and East, 13 cards each. The table size is fixed. The game ends when a player reaches 100 points and the lowest score wins.

```js
S = {
  hands: [[], [], [], []],
  phase: 'pass',                // 'pass', 'play' or 'trickEnd'
  dir: 0,                       // 0 left, 1 right, 2 across, 3 no pass (rounds % 4)
  trick: [{ p: 0, c: 40 }],     // cards on the table, in the order played
  turn: 0, tricks: 0, broken: false,
  taken: [0, 0, 0, 0],          // points taken this round
  added: [0, 0, 0, 0], totals: [0, 0, 0, 0], moon: -1,
  rounds: 0, over: false, matchOver: false, msg: ''
};
```

**Rules implemented.**

- Each round starts with passing three cards: left, then right, then across, then a round with no pass.
- The holder of the 2 of clubs leads it. Players must follow the led suit if they can. The highest card of the led suit takes the trick, and Aces are high (`hv`).
- Hearts cannot be led until a heart has been played, unless the leader holds nothing else.
- No heart or queen of spades may be played on the first trick unless the player has only point cards.
- Each heart is 1 point and the queen of spades is 13 (`pts`). A player who takes all 26 points scores 0 and everyone else gets 26.
- `legal(p, c)` holds all of the play rules.

**Trick timing.** After the fourth card the phase becomes `trickEnd`. The computer loop leaves the trick on screen for 1.3 seconds, then `endTrick()` awards it and sets the next leader.

**Computer strategy.** `aiPass` passes the queen of spades, the Ace and King of spades, and then the highest hearts and other high cards. `aiPlay` leads its lowest safe card, ducks under the winning card with its biggest losing card, and when it cannot follow suit dumps the queen of spades, then its highest heart, then its highest card.

## FreeCell

FreeCell solitaire: all 52 cards are dealt face up into eight columns, with four free cells and four foundations.

```js
S = {
  cols:  [[], [], [], [], [], [], [], []],
  cells: [-1, -1, -1, -1],      // card id, or -1 when the cell is empty
  found: [0, 0, 0, 0],          // highest rank placed for each suit
  moves: 0, over: false
};
```

**Rules implemented.**

- Columns build down in alternating colours (`stacks`). Any card or valid run may move to an empty column.
- A free cell holds one card. Foundations build up by suit from the Ace.
- A run of several cards moves in one step when it could have been moved one card at a time: at most (empty cells + 1) x 2^(empty columns), not counting an empty destination column (`capacity`).
- `auto()` sends a card to its foundation by itself when no lower card of the opposite colour could still need it.

**Controls.** FreeCell is tap-to-move, with no dragging: tap a card to pick it up (it and the run below it turn gold), then tap a column, free cell or foundation. Tapping the picked card again puts it down. Undo keeps up to 300 steps, and Restart replays the same deal.

**Layout.** Eight CSS grid columns, with card width taken from the screen width (about 41 px on a phone). Each column's overlap is the `--off` variable, reduced for long columns so they fit the screen.

## Saving

The game in progress is written to the browser's `localStorage` under the key `klondike-v1` after every move, and every 10 seconds while the timer runs. The saved object holds the state `S`, the opening deal `first`, the undo `history`, the draw mode, the elapsed seconds, the won flag, the scoring mode `vegas` and the `bank`.

On load, `start()` reads the save and passes it through `valid()`, which checks that the piles exist and add up to 52 cards. A missing or damaged save simply produces a new deal. Every storage call is wrapped in `try`/`catch` because storage can be disabled or full.

The save belongs to one browser on one device. Syncing a game between devices would need a server and is out of scope.

The other games save the same way under their own keys (Crazy Eights, Hearts and FreeCell use eights-v1, hearts-v1 and freecell-v1). Rummy and Sevens use `rummy-v1` and `sevens-v1`, after every action. Their running scores are part of the saved state.

## Run and debug in VS Code

**Run.** Right-click `index.html` in the Explorer and choose Open with Live Server, or click Go Live in the status bar. The game opens at `http://localhost:5500/index.html` and reloads on every save.

**Debug.** Create `.vscode/launch.json`, start Live Server, then press F5. Breakpoints set in the `<script>` block of `index.html` are hit in VS Code.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Klondike in Chrome",
      "url": "http://localhost:5500/index.html",
      "webRoot": "${workspaceFolder}"
    },
    {
      "type": "msedge",
      "request": "launch",
      "name": "Klondike in Edge",
      "url": "http://localhost:5500/index.html",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

Useful breakpoints: `doMove` (every card move), `dropTarget` (why a drop was rejected), `layout` (positions), and `play` (whether a sound was scheduled).

**Test on a phone.** Put the phone on the same Wi-Fi network as the computer and open `http://<computer-ip>:5500/index.html`. Find the address with `ipconfig` on Windows or `ip addr` / `ifconfig` on Linux, Unix and macOS. The operating system firewall may ask to allow the connection. For a quick first check without a phone, use the device toolbar in the browser's developer tools, which simulates touch and small screens.

**Reset a saved game.** In the browser console run `localStorage.removeItem('klondike-v1')` and reload.

## Test checklist

Run through this list on at least one desktop browser and one phone before each release.

- [ ] A new deal shows 1 to 7 cards per column with only the last card face up, and 24 cards in the stock
- [ ] Tapping an Ace sends it to a foundation; tapping a card with no legal move shakes it
- [ ] A run of several cards can be dragged between columns; an illegal drop returns it
- [ ] Only a King (or a run starting with one) can be placed on an empty column
- [ ] Draw 1 and Draw 3 both work, and tapping the empty stock turns the waste back over
- [ ] Undo reverses moves, draws and recycles, and restores the score
- [ ] Restart replays the same deal; New deal gives a different one
- [ ] Finish for me appears when the stock and waste are both empty and all cards are face up, and completes the game
- [ ] Vegas: the deal starts at −$52, each foundation card pays $5, Draw 1 allows one pass and Draw 3 three, the bank carries across deals and survives a reload, and Reset bank returns it to $0
- [ ] About opens from the Klondike footer, and Close or Esc returns to the game
- [ ] The win screen shows time, moves and score
- [ ] Reloading the page restores the game in progress
- [ ] With Wi-Fi and mobile data off, every game opens and plays, and both fonts still show
- [ ] Rotating a phone or resizing the window re-fits the cards
- [ ] Dragging a card on a touch screen does not scroll the page
- [ ] Sound plays after the first tap, and the Sound button mutes and unmutes it

Menu, Rummy and Sevens:

- [ ] The menu opens each game, and Games returns to the menu without losing a game in progress
- [ ] Picking a card design on the menu changes the backs in every game, and the choice survives a reload
- [ ] Picking a language on the menu translates the menu, every game's controls and status messages, and the choice survives a reload; a browser set to Spanish or French starts in that language
- [ ] Rummy: drawing from the stock and from the discard pile both work, and the hand grows by one card
- [ ] Rummy: Meld is enabled only for a valid set or run, and laying off onto a table meld works
- [ ] Rummy: the card just taken from the discard pile cannot be discarded that turn
- [ ] Rummy: going out ends the round and the winner's score rises by the other hands' pip total
- [ ] Rummy: reaching 100 points ends the match and offers a new one
- [ ] Sevens: the holder of the 7 of diamonds starts, and only that card can be played first
- [ ] Sevens: only raised cards can be played, and Pass is enabled only when no card can be played
- [ ] Sevens: the round ends when a hand is empty and penalty points equal the cards left
- [ ] Computer players pause when you leave a game and resume when you return
- [ ] Opponents 1, 2 and 3 each deal the right number of seats and cards in both games, and the choice survives a reload
- [ ] Crazy Eights: only matching cards and eights are raised, an eight opens the suit panel, and the called suit is enforced
- [ ] Crazy Eights: drawing is allowed once per turn and Pass is enabled only after drawing, or at once when the stock is empty and the discard pile holds a single card
- [ ] Hearts: three cards can be selected and passed, and the pass direction rotates each round
- [ ] Hearts: following suit is enforced, hearts cannot be led before they are broken, and the trick stays visible before it is taken
- [ ] Hearts: round points add up to 26, and taking all 26 gives the other players 26 each
- [ ] FreeCell: a picked run moves only when it is short enough for the free cells and empty columns
- [ ] FreeCell: Undo and Restart work, and solving the deal shows the result panel

**Scripted run.** `test/checklist.js` drives the Klondike items above in headless Chrome, using the game's own save format to load fixtures for the rules, auto-finish and touch tests, then opens every game from the menu, checks the Crazy Eights pass rule and the language picker. It needs Node.js and Google Chrome. Screenshots land in `test/screenshots/`.

```bash
cd test
npm install
npm test
```

It cannot hear sound, so that item still needs a person.

## Packaging

The game already runs on every target through a browser. These three routes turn the same `index.html` into something installable. The Capacitor route is set up and was run for this guide; the progressive web app and Tauri commands are written from memory of the current major versions, so confirm them against the linked official guides.

| Route | Targets | Result | Extra tooling |
| --- | --- | --- | --- |
| Progressive web app | Every platform with a modern browser | Installed from the browser, works offline | A web host with HTTPS |
| [Tauri](https://tauri.app/start/) | Windows, macOS, Linux | Native installers (`.msi`/`.exe`, `.dmg`, `.deb`/`.AppImage`) | Node.js, Rust |
| [Capacitor](https://capacitorjs.com/docs/getting-started) | iOS, Android | App Store and Play Store packages | Node.js, Xcode, Android Studio |

Other Unix systems such as the BSDs are served by the browser or the progressive web app.

**Progressive web app.** Add three things next to `index.html` and host the folder on any static HTTPS host:

1. A `manifest.webmanifest` with the name, colours, `"display": "standalone"` and 192 px and 512 px icons, linked with `<link rel="manifest" href="manifest.webmanifest">`.
2. A `sw.js` service worker that caches `index.html` so the game opens offline.
3. One line in the script to register it: `navigator.serviceWorker.register('sw.js')`.

**Tauri (desktop).** Move `index.html` into a `dist/` folder, then from the project root:

```bash
npm init -y
npm install -D @tauri-apps/cli
npx tauri init      # answer: web assets are in ../dist, no dev server or build command
npx tauri dev       # run in a native window
npx tauri build     # produce the installer for the current operating system
```

Tauri builds for the operating system it runs on. Producing Windows, macOS and Linux installers needs one build on each, most easily with a GitHub Actions matrix.

**Capacitor (mobile).** The store projects are set up in this folder with Capacitor 8 under the identifier `com.lvalverdeb.cardtable`. The store listing name is Card Table: Six Games (also the page title and the iOS bundle name); the label under the icon and the in-app header stay Card Table, because home screens truncate long labels:

| Path | What it is |
| --- | --- |
| `capacitor.config.json` | App id, name, `dist/` as the web folder, felt green behind the web view |
| `dist/` | A copy of `index.html` and `fonts/`, refreshed by `npm run build`; never edit it |
| `android/` | The Android Studio project, with the icons, splash screens and release signing in place |
| `ios/` | The Xcode project (Swift Package Manager, no CocoaPods), with icons, splash screens and `en`, `es`, `fr` declared |
| `assets/` | The 1024 px icon and 2732 px splash sources that `@capacitor/assets` expands into both projects |
| `fonts/LICENSE.txt` | The full SIL Open Font License for both typefaces; it ships inside `dist/` and both packages. The About panel also credits the fonts and Capacitor |
| `android/keystore/upload-keystore.jks`, `android/keystore.properties` | The Play upload key and its passwords, read by `app/build.gradle`; both are ignored by git and must be backed up |

Everyday commands, from the project root:

```bash
npm run sync             # copy index.html and the fonts into dist/ and into both native projects; run after every change
npm run android:bundle   # sync, then build the signed Play bundle: android/app/build/outputs/bundle/release/app-release.aab
npm run ios:open         # sync, then open the Xcode project
npx cap sync             # alone, when only native settings changed
```

The Android build needs JDK 21 and the Android SDK. Both were installed with Homebrew (`temurin@21`, `android-commandlinetools`); the SDK location is written in `android/local.properties` (not committed), and Gradle picks up the JDK from `JAVA_HOME` or from `org.gradle.java.home` in your user-level `~/.gradle/gradle.properties`, so nothing machine-specific lives in the repository. The GitHub Actions workflow in `.github/workflows/ci.yml` runs the Playwright checklist and builds an unsigned release bundle and a debug APK from a clean checkout on every push, which proves the repository alone is enough to produce the Play upload; only the signing step needs the local keystore. After a successful build, upload `app-release.aab` in the Play Console; Play App Signing manages the final signing key, and the keystore here is only the upload key. Bump `versionCode` and `versionName` in `android/app/build.gradle` before each new upload.

**Android emulator.** `test/android-emulator.sh` boots a headless Pixel 7 image, installs the release APK, launches it and saves a screenshot, then leaves the emulator running for `adb` checks. It needs three more SDK pieces, installed once with `sdkmanager --sdk_root=$HOME/Library/Android/sdk "emulator" "system-images;android-36;default;arm64-v8a"` plus a copy of the command-line tools inside the SDK root (`cp -R /opt/homebrew/share/android-commandlinetools/cmdline-tools ~/Library/Android/sdk/`), because `avdmanager` only sees system images under its own SDK. The emulator run checked the menu and Klondike layouts, the back button (returns to the menu from a game, closes the app from the menu), the felt-coloured system bars, and language detection through a per-app locale (`adb shell cmd locale set-app-locales com.lvalverdeb.cardtable --user 0 --locales es-MX`).

**iOS simulator.** `test/ios-simulator.sh [screenshot] [language]` builds the Debug app with `xcodebuild`, installs it fresh on the iPhone 17 simulator, launches it and saves a screenshot; pass a language tag such as `es-MX` or `fr-FR` to set the device language first. Two things to know: the simulator keeps app data across reinstalls, so the script uninstalls first (a saved language pick would otherwise mask the device language), and per-launch `-AppleLanguages` arguments do not reach the WebView, so the device language is set with `defaults write` on a booted simulator and applied by restarting it. The simulator run checked the menu in English, Spanish and French.

**Google Play store kit.** `store/` holds everything the Play Console asks for: the 512 px icon and 1024 × 500 feature graphic in `graphics/`, phone and tablet screenshots in three languages in `screenshots/`, the listing text in `listing-en.md`, `listing-es.md` and `listing-fr.md`, the privacy policy page, and `PLAY_CONSOLE_STEPS.md`, which walks through the console from account creation to production. `test/store-screenshots.js` regenerates the screenshots and feature graphic from the live page.

The iOS build needs Xcode from the Mac App Store and an Apple Developer account; neither can be scripted here. In Xcode, open `ios/App/App.xcodeproj`, choose your team under Signing & Capabilities, then Product → Archive and Distribute App to App Store Connect. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in the project for each upload. Icons, the launch screen and the bundle identifier are already set.

`android/app/src/main/res/values/styles.xml` colours the Android status and navigation bars felt green with light icons, so they match the page header and footer as they do on iOS. The Android back button acts as the Games button and leaves the app from the menu, through the `@capacitor/app` plugin; the page checks for the plugin so the same file still runs in a plain browser. Saves stay in `localStorage`, which both platforms' web views keep across launches; the Preferences plugin is an option if a device ever clears it under storage pressure.

**Already done for packaged builds.** The fonts are bundled locally, so the page makes no network requests at all. The viewport uses `viewport-fit=cover` with pinch zoom and overscroll disabled, and the header, footers and Klondike felt pad themselves by the device's safe-area insets so the notch and home indicator never cover the controls.

## Open issues

- **Sound is unconfirmed on the reporting device.** Sound was reported silent after the first release. An instrumented test in headless Chrome showed the audio context running and effects being scheduled, and the unlock code was then hardened, but nobody has yet confirmed hearing sound. Device and browser of the report are unknown.
- **No human playthrough has been done.** A scripted run in headless Chrome exercised every Klondike checklist item, including auto-finish, the cascade and the win screen, and all passed. The checklist still needs a run by hand on at least one phone.
- **Packaging steps are untested.** No PWA, Tauri or Capacitor build has been produced from this code.
- **No keyboard play.** Cards can only be moved with a pointer.
- **No guaranteed-winnable deals.** Deals are purely random.

* **Rummy and Sevens were tested by script only.** Policy-driven play (Nov 17, 2026) finished several rounds of each, laid off onto melds, and ran Rummy to its 100-point match end, with card conservation checked after every click. Melding a set or run by hand has not been exercised, because a random selection rarely forms one.
* **Computer players are simple.** They meld as soon as they can and do not track which cards opponents pick up.
* **Player-count changes reset scores.** Switching the number of opponents starts a new game without asking, even mid-round. One-opponent and two-opponent tables were each played once by script.
* **Crazy Eights, Hearts and FreeCell were tested by script only.** Weighted random play (Nov 17, 2026) finished seven Crazy Eights rounds and ran the match to its 200-point end, finished Hearts rounds including one where a computer player shot the moon and the 100-point ending that followed, and made 100 legal FreeCell moves across 53 deals, all without errors or card-conservation failures. The Crazy Eights reshuffle and a solved FreeCell deal have not been exercised.
* **FreeCell has no drag and drop.** It is tap-to-move only, unlike Klondike.

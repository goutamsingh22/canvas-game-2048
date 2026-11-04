# Canvas 2048

A polished 2048 game built with vanilla JavaScript, HTML Canvas, `localStorage`, and Vitest.

The game engine is a set of pure functions, so the merge rules, scoring, win detection, and
persistence are all covered by fast unit tests. The browser layer stays thin: a Canvas renderer,
input handling, and a small amount of HUD state.

## Features

- Full 2048 rules: slide, merge, spawn, score, win, lose
- Smooth tile slide, merge-pop, and spawn animations
- Canvas board that scales crisply on high-DPI and small screens
- Keyboard, WASD, and touch-swipe controls
- Undo history (last 20 moves) plus keyboard shortcuts
- Score and best score with a score-gain animation
- `localStorage` session restore and best-score persistence
- Win overlay with "keep going", game-over overlay with retry / undo
- Accessible controls, focus states, and `prefers-reduced-motion` support
- No runtime dependencies

## Controls

| Action     | Keys                        |
| ---------- | --------------------------- |
| Move       | Arrow keys or `WASD`        |
| Undo       | `Z`                         |
| New game   | `R`                         |
| Move       | Swipe on the board          |

## Run locally

The app uses native ES modules, so serve the folder over HTTP:

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

You can use any static server instead, for example `npx serve .` from this folder.

## Test

```bash
npm test
```

Vitest runs the pure engine and renderer-helper suites:

- `test/game.test.js` — board creation, spawning, slide/merge rules, scoring, win/loss checks
- `test/session.test.js` — turn lifecycle, undo, win-continue, serialization
- `test/storage.test.js` — schema validation, corrupted data, unavailable storage
- `test/renderer.test.js` — palette, layout maths, easing, pop animation helpers

## Project structure

```text
canvas-2048/
├── index.html
├── styles.css
├── src/
│   ├── main.js       # browser bootstrap: input, HUD, game loop, persistence
│   ├── game.js       # pure board + movement engine
│   ├── session.js    # scoring, status, undo history, serialization
│   ├── renderer.js   # Canvas drawing and animations
│   └── storage.js    # validated localStorage adapter
├── test/
│   ├── game.test.js
│   ├── session.test.js
│   ├── storage.test.js
│   └── renderer.test.js
└── package.json
```

## How the movement algorithm works

For each row or column, the engine walks tiles in the direction of travel and packs them into the
far edge. Equal neighbours merge once per move. The scan never revisits a merged tile, so
`[2, 2, 2, 2]` becomes `[4, 4, 0, 0]` rather than `[8, 0, 0, 0]`.

`move()` returns both the next board and a list of transitions:

```js
{
  board: [[4, 8, 0, 0], ...],
  score: 12,
  moved: true,
  transitions: [{ from: { row: 0, col: 0 }, to: { row: 0, col: 0 }, value: 2, merged: true }, ...],
  merges: [{ row: 0, col: 0, value: 4 }]
}
```

The renderer uses `transitions` to slide old tiles to their new cells, then pops newly merged and
spawned tiles. Keeping this data separate means the engine has no Canvas dependency.

## Persistence

Two keys are used:

| Key                      | Value                                                     |
| ------------------------ | --------------------------------------------------------- |
| `canvas2048.session.v1`  | `{ version, size, board, score, status, keepPlaying }`    |
| `canvas2048.best.v1`     | best score as a string                                    |

Every stored session is validated before use: the board must be square, values must be zero or a
power of two of at least 2, and the score/status must be sane. Corrupt or unavailable storage is
ignored, so the game keeps working in private browsing or when storage is blocked.

## License

MIT

import { Renderer } from './renderer.js';
import { Game, STATUS } from './session.js';
import { createStorage } from './storage.js';

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const scoreGainEl = document.getElementById('score-gain');
const undoBtn = document.getElementById('undo');
const newGameBtn = document.getElementById('new-game');
const overlay = document.getElementById('overlay');
const overlayKicker = document.getElementById('overlay-kicker');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayPrimary = document.getElementById('overlay-primary');
const overlaySecondary = document.getElementById('overlay-secondary');

const KEY_DIRECTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  A: 'left',
  D: 'right',
  W: 'up',
  S: 'down'
};

const SWIPE_THRESHOLD = 24;

const storage = createStorage();
const game = new Game();
const renderer = new Renderer(canvas, { size: game.size });

let best = storage.loadBest();
let overlayState = null;
let pointerStart = null;

function persist() {
  storage.saveSession(game.serialize());

  if (game.score > best) {
    best = game.score;
    storage.saveBest(best);
  }
}

function showScoreGain(points) {
  if (points <= 0) {
    return;
  }

  scoreGainEl.textContent = `+${points}`;
  scoreGainEl.classList.remove('is-visible');
  void scoreGainEl.offsetWidth;
  scoreGainEl.classList.add('is-visible');
  scoreGainEl.addEventListener(
    'animationend',
    () => scoreGainEl.classList.remove('is-visible'),
    { once: true }
  );
}

function hideOverlay() {
  if (!overlay.hidden) {
    overlay.hidden = true;

    if (overlay.contains(document.activeElement)) {
      newGameBtn.focus({ preventScroll: true });
    }
  }

  overlayState = null;
}

function updateOverlay() {
  if (game.status === STATUS.PLAYING) {
    hideOverlay();
    return;
  }

  if (overlayState === game.status) {
    overlaySecondary.disabled = game.status === STATUS.OVER && !game.canUndo;
    return;
  }

  overlayState = game.status;
  overlay.hidden = false;

  if (game.status === STATUS.WON) {
    overlayKicker.textContent = 'Milestone reached';
    overlayTitle.textContent = 'You made 2048!';
    overlayText.textContent = 'Keep going to chase an even bigger tile.';
    overlayPrimary.textContent = 'Keep going';
    overlaySecondary.textContent = 'New game';
    overlaySecondary.disabled = false;
    overlayPrimary.onclick = () => {
      game.continuePlaying();
      renderer.setBoard(game.board);
      persist();
      updateHud();
    };
    overlaySecondary.onclick = restart;
  } else {
    overlayKicker.textContent = 'No moves left';
    overlayTitle.textContent = 'Game over';
    overlayText.textContent = `You scored ${game.score.toLocaleString()} points.`;
    overlayPrimary.textContent = 'Try again';
    overlaySecondary.textContent = 'Undo last move';
    overlaySecondary.disabled = !game.canUndo;
    overlayPrimary.onclick = restart;
    overlaySecondary.onclick = performUndo;
  }

  overlayPrimary.focus({ preventScroll: true });
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  bestEl.textContent = String(best);
  undoBtn.disabled = !game.canUndo;
  updateOverlay();
}

function restart() {
  game.reset();
  renderer.showNewGame(game.board, game.spawns);
  persist();
  updateHud();
}

function performMove(direction) {
  const result = game.move(direction);

  if (!result.moved) {
    return;
  }

  renderer.playMove(result);
  persist();
  showScoreGain(result.score);
  updateHud();
}

function performUndo() {
  if (!game.undo()) {
    return;
  }

  renderer.setBoard(game.board);
  persist();
  updateHud();
}

const saved = storage.loadSession();

if (saved && game.restore(saved)) {
  renderer.size = game.size;
  renderer.setBoard(game.board);
  best = Math.max(best, game.score);
} else {
  renderer.showNewGame(game.board, game.spawns);
}

persist();
updateHud();

undoBtn.addEventListener('click', performUndo);
newGameBtn.addEventListener('click', restart);

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const direction = KEY_DIRECTIONS[event.key];

  if (direction) {
    event.preventDefault();
    performMove(direction);
    return;
  }

  if (event.key === 'z' || event.key === 'Z') {
    event.preventDefault();
    performUndo();
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restart();
  }
});

canvas.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart) {
    return;
  }

  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
    return;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    performMove(dx > 0 ? 'right' : 'left');
  } else {
    performMove(dy > 0 ? 'down' : 'up');
  }
});

canvas.addEventListener('pointercancel', () => {
  pointerStart = null;
});

function resize() {
  renderer.resize();
}

if ('ResizeObserver' in window) {
  new ResizeObserver(resize).observe(canvas.parentElement);
} else {
  window.addEventListener('resize', resize);
}

function frame(now) {
  renderer.render(now);
  window.requestAnimationFrame(frame);
}

resize();
window.requestAnimationFrame(frame);

import {
  cloneBoard,
  createBoard,
  hasMoves,
  hasWon,
  move,
  SIZE,
  spawnTile,
  WIN_VALUE
} from './game.js';

export const STATUS = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  OVER: 'over'
});

export class Game {
  constructor({
    size = SIZE,
    winningValue = WIN_VALUE,
    random = Math.random,
    historyLimit = 20
  } = {}) {
    this.size = size;
    this.winningValue = winningValue;
    this.random = random;
    this.historyLimit = historyLimit;
    this.reset();
  }

  get canUndo() {
    return this.history.length > 0;
  }

  reset() {
    this.board = createBoard(this.size);
    this.score = 0;
    this.status = STATUS.PLAYING;
    this.keepPlaying = false;
    this.history = [];
    this.lastMove = null;

    const first = spawnTile(this.board, this.random);
    const second = spawnTile(this.board, this.random);
    this.spawns = [first, second].filter(Boolean);

    return this.spawns;
  }

  refreshStatus() {
    if (!this.keepPlaying && hasWon(this.board, this.winningValue)) {
      this.status = STATUS.WON;
    } else if (!hasMoves(this.board)) {
      this.status = STATUS.OVER;
    } else {
      this.status = STATUS.PLAYING;
    }

    return this.status;
  }

  move(direction) {
    if (this.status !== STATUS.PLAYING) {
      return { moved: false, reason: this.status };
    }

    const previousBoard = cloneBoard(this.board);
    const result = move(this.board, direction);

    if (!result.moved) {
      return { moved: false, reason: 'blocked' };
    }

    this.history.push({
      board: previousBoard,
      score: this.score,
      status: this.status,
      keepPlaying: this.keepPlaying
    });

    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    this.board = result.board;
    this.score += result.score;

    const spawn = spawnTile(this.board, this.random);
    this.spawns = spawn ? [spawn] : [];
    this.lastMove = result;
    this.refreshStatus();

    return {
      moved: true,
      board: this.board,
      score: result.score,
      transitions: result.transitions,
      merges: result.merges,
      spawn,
      status: this.status
    };
  }

  undo() {
    const snapshot = this.history.pop();

    if (!snapshot) {
      return false;
    }

    this.board = cloneBoard(snapshot.board);
    this.score = snapshot.score;
    this.status = snapshot.status;
    this.keepPlaying = snapshot.keepPlaying;
    this.spawns = [];
    this.lastMove = null;

    return true;
  }

  continuePlaying() {
    if (this.status !== STATUS.WON) {
      return false;
    }

    this.keepPlaying = true;
    this.refreshStatus();

    return true;
  }

  serialize() {
    return {
      version: 1,
      size: this.size,
      board: cloneBoard(this.board),
      score: this.score,
      status: this.status,
      keepPlaying: this.keepPlaying
    };
  }

  restore(snapshot) {
    this.size = snapshot.size ?? this.size;
    this.board = cloneBoard(snapshot.board);
    this.score = snapshot.score;
    this.status = snapshot.status ?? STATUS.PLAYING;
    this.keepPlaying = Boolean(snapshot.keepPlaying);
    this.history = [];
    this.spawns = [];
    this.lastMove = null;
    this.refreshStatus();

    return true;
  }
}

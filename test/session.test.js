import { describe, expect, it } from 'vitest';
import { Game, STATUS } from '../src/session.js';

function boardFrom(rows) {
  return rows.map((row) => row.slice());
}

function sequence(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

function emptyBoard() {
  return boardFrom([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
}

describe('Game session', () => {
  it('starts with two tiles and no history', () => {
    const game = new Game({ random: () => 0.5 });

    expect(game.board.flat().filter(Boolean)).toHaveLength(2);
    expect(game.score).toBe(0);
    expect(game.status).toBe(STATUS.PLAYING);
    expect(game.canUndo).toBe(false);
    expect(game.spawns).toHaveLength(2);
  });

  it('applies a move, awards points, and spawns a tile', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = boardFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    game.score = 0;
    game.random = sequence([0, 0.5]);

    const result = game.move('left');

    expect(result.moved).toBe(true);
    expect(result.score).toBe(4);
    expect(result.spawn).toEqual({ row: 0, col: 1, value: 2 });
    expect(result.board).toBe(game.board);
    expect(game.board[0]).toEqual([4, 2, 0, 0]);
    expect(game.score).toBe(4);
    expect(game.canUndo).toBe(true);
  });

  it('restores the previous turn with undo', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = boardFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    game.score = 0;
    game.random = sequence([0, 0.5]);

    game.move('left');
    const undone = game.undo();

    expect(undone).toBe(true);
    expect(game.board[0]).toEqual([2, 2, 0, 0]);
    expect(game.score).toBe(0);
    expect(game.status).toBe(STATUS.PLAYING);
    expect(game.canUndo).toBe(false);
    expect(game.spawns).toEqual([]);
  });

  it('ignores undo when there is nothing to undo', () => {
    const game = new Game({ random: () => 0.5 });

    expect(game.undo()).toBe(false);
  });

  it('does not record history for blocked moves', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);

    const result = game.move('left');

    expect(result).toMatchObject({ moved: false, reason: 'blocked' });
    expect(game.canUndo).toBe(false);
    expect(game.score).toBe(0);
  });

  it('refreshes game-over and win status from the board', () => {
    const game = new Game({ random: () => 0.5 });

    game.board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);
    expect(game.refreshStatus()).toBe(STATUS.OVER);

    game.board = boardFrom([
      [2048, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    expect(game.refreshStatus()).toBe(STATUS.WON);
  });

  it('stops accepting moves after a win until continued', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = boardFrom([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    game.random = sequence([0, 0.5]);

    const winning = game.move('left');

    expect(winning.moved).toBe(true);
    expect(winning.status).toBe(STATUS.WON);
    expect(game.move('right')).toMatchObject({ moved: false, reason: STATUS.WON });

    expect(game.continuePlaying()).toBe(true);
    expect(game.keepPlaying).toBe(true);
    expect(game.status).toBe(STATUS.PLAYING);

    game.random = sequence([0, 0.5]);
    expect(game.move('right').status).toBe(STATUS.PLAYING);
  });

  it('only continues from the won state', () => {
    const game = new Game({ random: () => 0.5 });

    expect(game.continuePlaying()).toBe(false);
  });

  it('serializes a detached snapshot and restores it', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = boardFrom([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    game.score = 128;

    const snapshot = game.serialize();
    snapshot.board[0][0] = 512;

    expect(game.board[0][0]).toBe(2);

    const restored = new Game({ random: () => 0.5 });
    restored.restore(snapshot);

    expect(restored.board[0][0]).toBe(512);
    expect(restored.score).toBe(128);
    expect(restored.status).toBe(STATUS.PLAYING);
    expect(restored.canUndo).toBe(false);
  });

  it('restores a dead board as game over', () => {
    const game = new Game({ random: () => 0.5 });
    game.board = emptyBoard();
    game.status = STATUS.PLAYING;

    game.restore({
      size: 4,
      board: boardFrom([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2]
      ]),
      score: 64,
      status: STATUS.PLAYING,
      keepPlaying: false
    });

    expect(game.status).toBe(STATUS.OVER);
    expect(game.score).toBe(64);
  });
});

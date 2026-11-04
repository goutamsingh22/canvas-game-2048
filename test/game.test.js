import { describe, expect, it } from 'vitest';
import {
  cloneBoard,
  createBoard,
  emptyCells,
  hasMoves,
  hasWon,
  move,
  randomTileValue,
  spawnTile
} from '../src/game.js';

function boardFrom(rows) {
  return rows.map((row) => row.slice());
}

function sequence(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('board helpers', () => {
  it('creates an empty square board', () => {
    const board = createBoard(4);

    expect(board).toHaveLength(4);
    expect(board.every((row) => row.length === 4)).toBe(true);
    expect(board.flat().every((value) => value === 0)).toBe(true);
  });

  it('clones boards without sharing rows', () => {
    const board = boardFrom([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    const clone = cloneBoard(board);

    clone[0][0] = 1024;

    expect(board[0][0]).toBe(2);
    expect(clone[0][0]).toBe(1024);
  });

  it('lists empty cells in reading order', () => {
    const board = boardFrom([
      [2, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 8]
    ]);

    expect(emptyCells(board)).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 }
    ]);
  });
});

describe('tile spawning', () => {
  it('spawns a 2 or 4 based on the random value', () => {
    expect(randomTileValue(() => 0.05)).toBe(4);
    expect(randomTileValue(() => 0.1)).toBe(2);
    expect(randomTileValue(() => 0.99)).toBe(2);
  });

  it('fills the first empty cell for a zero roll', () => {
    const board = createBoard(4);
    const spawn = spawnTile(board, sequence([0, 0.5]));

    expect(spawn).toEqual({ row: 0, col: 0, value: 2 });
    expect(board[0][0]).toBe(2);
  });

  it('can spawn on the last empty cell with a high roll', () => {
    const board = createBoard(4);
    const spawn = spawnTile(board, sequence([0.999, 0.05]));

    expect(spawn).toEqual({ row: 3, col: 3, value: 4 });
  });

  it('returns null when the board is full', () => {
    const board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);

    expect(spawnTile(board, () => 0)).toBeNull();
  });
});

describe('movement', () => {
  it('slides and merges a row to the left', () => {
    const board = boardFrom([
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);

    const result = move(board, 'left');

    expect(result.board[0]).toEqual([4, 8, 0, 0]);
    expect(result.score).toBe(12);
    expect(result.moved).toBe(true);
    expect(result.merges).toEqual([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 8 }
    ]);
  });

  it('merges each tile only once per move', () => {
    const board = boardFrom([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);

    const result = move(board, 'left');

    expect(result.board[0]).toEqual([4, 4, 0, 0]);
    expect(result.score).toBe(8);
  });

  it('does not chain merges created during the same move', () => {
    const board = boardFrom([
      [4, 4, 8, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);

    const result = move(board, 'left');

    expect(result.board[0]).toEqual([8, 8, 0, 0]);
    expect(result.score).toBe(8);
  });

  it('slides and merges a row to the right', () => {
    const board = boardFrom([
      [2, 2, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);

    const result = move(board, 'right');

    expect(result.board[0]).toEqual([0, 0, 4, 4]);
    expect(result.score).toBe(4);
  });

  it('slides and merges columns up and down', () => {
    const board = boardFrom([
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0]
    ]);

    const up = move(board, 'up');
    const down = move(board, 'down');

    expect(up.board.map((row) => row[0])).toEqual([4, 8, 0, 0]);
    expect(down.board.map((row) => row[0])).toEqual([0, 0, 4, 8]);
    expect(up.score).toBe(12);
    expect(down.score).toBe(12);
  });

  it('reports no movement when the board cannot change', () => {
    const board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);

    const result = move(board, 'left');

    expect(result.moved).toBe(false);
    expect(result.score).toBe(0);
    expect(result.board).toEqual(board);
  });

  it('does not mutate the input board', () => {
    const board = boardFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    const snapshot = cloneBoard(board);

    move(board, 'left');

    expect(board).toEqual(snapshot);
  });

  it('emits one transition per existing tile', () => {
    const board = boardFrom([
      [2, 2, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4]
    ]);

    const result = move(board, 'left');

    expect(result.transitions).toHaveLength(4);
    expect(result.transitions).toContainEqual({
      from: { row: 0, col: 2 },
      to: { row: 0, col: 1 },
      value: 4,
      merged: false
    });
  });

  it('handles empty boards in every direction', () => {
    const board = createBoard(4);

    for (const direction of ['left', 'right', 'up', 'down']) {
      const result = move(board, direction);
      expect(result.moved).toBe(false);
      expect(result.score).toBe(0);
    }
  });

  it('rejects unknown directions', () => {
    expect(() => move(createBoard(4), 'diagonal')).toThrow(/Unknown direction/);
  });
});

describe('game state detection', () => {
  it('detects a winning tile at or above the target', () => {
    const board = createBoard(4);
    board[1][2] = 2048;

    expect(hasWon(board)).toBe(true);
    expect(hasWon(board, 4096)).toBe(false);
  });

  it('reports moves while empty cells remain', () => {
    const board = createBoard(4);
    board[0][0] = 2;

    expect(hasMoves(board)).toBe(true);
  });

  it('reports moves when neighbours can merge', () => {
    const board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 2, 4]
    ]);

    expect(hasMoves(board)).toBe(true);
  });

  it('reports game over on a full board without merges', () => {
    const board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);

    expect(hasMoves(board)).toBe(false);
  });
});

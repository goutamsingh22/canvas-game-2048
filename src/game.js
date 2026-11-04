export const SIZE = 4;
export const WIN_VALUE = 2048;
export const FOUR_PROBABILITY = 0.1;

export function createBoard(size = SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function emptyCells(board) {
  const cells = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === 0) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

export function randomTileValue(random = Math.random) {
  return random() < FOUR_PROBABILITY ? 4 : 2;
}

export function spawnTile(board, random = Math.random) {
  const cells = emptyCells(board);

  if (cells.length === 0) {
    return null;
  }

  const { row, col } = cells[Math.floor(random() * cells.length)];
  const value = randomTileValue(random);
  board[row][col] = value;

  return { row, col, value };
}

export function hasWon(board, target = WIN_VALUE) {
  return board.some((row) => row.some((value) => value >= target));
}

export function hasMoves(board) {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const value = board[row][col];

      if (value === 0) {
        return true;
      }

      if (col + 1 < board[row].length && board[row][col + 1] === value) {
        return true;
      }

      if (row + 1 < board.length && board[row + 1][col] === value) {
        return true;
      }
    }
  }

  return false;
}

function lineCoords(size, direction, line) {
  const coords = [];

  for (let step = 0; step < size; step += 1) {
    switch (direction) {
      case 'left':
        coords.push({ row: line, col: step });
        break;
      case 'right':
        coords.push({ row: line, col: size - 1 - step });
        break;
      case 'up':
        coords.push({ row: step, col: line });
        break;
      case 'down':
        coords.push({ row: size - 1 - step, col: line });
        break;
      default:
        throw new Error(`Unknown direction: ${direction}`);
    }
  }

  return coords;
}

function slideLine(tiles) {
  const slots = [];
  let score = 0;

  for (const tile of tiles) {
    const last = slots[slots.length - 1];

    if (last && last.value === tile.value && !last.merged) {
      last.value *= 2;
      last.merged = true;
      last.sources.push(tile);
      score += last.value;
    } else {
      slots.push({ value: tile.value, merged: false, sources: [tile] });
    }
  }

  return { slots, score };
}

export function move(board, direction) {
  const size = board.length;

  if (!['left', 'right', 'up', 'down'].includes(direction)) {
    throw new Error(`Unknown direction: ${direction}`);
  }

  const next = createBoard(size);
  const transitions = [];
  const merges = [];
  let score = 0;
  let moved = false;

  for (let line = 0; line < size; line += 1) {
    const coords = lineCoords(size, direction, line);
    const tiles = coords
      .map(({ row, col }) => ({ row, col, value: board[row][col] }))
      .filter((tile) => tile.value !== 0);

    if (tiles.length === 0) {
      continue;
    }

    const { slots, score: lineScore } = slideLine(tiles);
    score += lineScore;

    slots.forEach((slot, index) => {
      const target = coords[index];
      next[target.row][target.col] = slot.value;

      if (slot.merged) {
        merges.push({ row: target.row, col: target.col, value: slot.value });
      }

      slot.sources.forEach((source) => {
        const isMoving = source.row !== target.row || source.col !== target.col;

        if (isMoving || slot.merged) {
          moved = true;
        }

        transitions.push({
          from: { row: source.row, col: source.col },
          to: { row: target.row, col: target.col },
          value: source.value,
          merged: slot.merged
        });
      });
    });
  }

  return { board: next, score, moved, transitions, merges };
}

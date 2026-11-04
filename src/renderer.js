export const BOARD_COLOR = '#bbada0';
export const EMPTY_COLOR = '#cdc1b4';
export const SUPER_TILE_COLOR = '#3c3a32';
export const SLIDE_MS = 110;
export const POP_MS = 130;

function cellKey(row, col) {
  return `${row}:${col}`;
}

export const PALETTE = Object.freeze({
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e'
});

export function tileColor(value) {
  return PALETTE[value] ?? SUPER_TILE_COLOR;
}

export function tileTextColor(value) {
  return value <= 4 ? '#776e65' : '#f9f6f2';
}

export function fontSizeFor(value, cell) {
  const digits = String(value).length;

  if (digits <= 2) {
    return cell * 0.46;
  }

  if (digits === 3) {
    return cell * 0.38;
  }

  if (digits === 4) {
    return cell * 0.3;
  }

  return cell * 0.24;
}

export function getMetrics(size, width) {
  const padding = Math.max(8, width * 0.032);
  const gap = Math.max(6, width * 0.023);
  const cell = (width - padding * 2 - gap * (size - 1)) / size;

  return { padding, gap, cell, board: width - padding * 2 };
}

export function cellRect(metrics, row, col) {
  return {
    x: metrics.padding + col * (metrics.cell + metrics.gap),
    y: metrics.padding + row * (metrics.cell + metrics.gap),
    w: metrics.cell,
    h: metrics.cell
  };
}

export function easeOutCubic(progress) {
  const t = Math.min(1, Math.max(0, progress));

  return 1 - (1 - t) ** 3;
}

export function popScale(progress, from = 0, peak = 1.1) {
  const t = Math.min(1, Math.max(0, progress));

  if (t === 0) {
    return from;
  }

  if (t === 1) {
    return 1;
  }

  if (t < 0.6) {
    return from + (peak - from) * (t / 0.6);
  }

  return peak - (peak - 1) * ((t - 0.6) / 0.4);
}

export function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

export function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas, { size = 4 } = {}) {
    if (!canvas) {
      throw new Error('A canvas element is required');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = size;
    this.width = 480;
    this.board = null;
    this.animation = null;
    this.effects = new Map();
    this.reduceMotion = Boolean(
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(240, Math.round(rect.width || this.canvas.clientWidth || 480));
    const dpr = globalThis.devicePixelRatio || 1;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(width * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
  }

  setBoard(board) {
    this.board = board;
    this.animation = null;
    this.effects.clear();
  }

  playMove(result, now = performance.now()) {
    if (this.reduceMotion) {
      this.setBoard(result.board);
      return;
    }

    this.board = result.board;
    this.effects.clear();
    this.animation = {
      start: now,
      transitions: result.transitions,
      merges: result.merges,
      spawn: result.spawn
    };
  }

  showNewGame(board, spawns, now = performance.now()) {
    this.board = board;
    this.animation = null;
    this.effects.clear();

    if (this.reduceMotion) {
      return;
    }

    for (const spawn of spawns) {
      this.effects.set(cellKey(spawn.row, spawn.col), { start: now, kind: 'spawn' });
    }
  }

  render(now = performance.now()) {
    if (!this.board) {
      return;
    }

    const { ctx, width } = this;
    const metrics = getMetrics(this.size, width);

    ctx.clearRect(0, 0, width, width);
    this.drawBackground(metrics);

    if (this.animation) {
      const elapsed = now - this.animation.start;

      if (elapsed < SLIDE_MS) {
        this.drawSlide(metrics, this.animation, easeOutCubic(elapsed / SLIDE_MS));
        return;
      }

      this.drawBoardWithEffects(metrics, this.board, this.moveEffects(), now);

      if (elapsed >= SLIDE_MS + POP_MS) {
        this.animation = null;
      }

      return;
    }

    this.drawBoardWithEffects(metrics, this.board, this.effects, now);
    this.expireEffects(now);
  }

  moveEffects() {
    const effects = new Map();
    const start = this.animation.start + SLIDE_MS;

    if (this.animation.spawn) {
      const { row, col } = this.animation.spawn;
      effects.set(cellKey(row, col), { start, kind: 'spawn' });
    }

    for (const merge of this.animation.merges) {
      effects.set(cellKey(merge.row, merge.col), { start, kind: 'merge' });
    }

    return effects;
  }

  drawSlide(metrics, animation, progress) {
    for (const transition of animation.transitions) {
      const from = cellRect(metrics, transition.from.row, transition.from.col);
      const to = cellRect(metrics, transition.to.row, transition.to.col);
      const rect = {
        x: lerp(from.x, to.x, progress),
        y: lerp(from.y, to.y, progress),
        w: from.w,
        h: from.h
      };

      this.drawTile(rect, transition.value);
    }
  }

  drawBoardWithEffects(metrics, board, effects, now) {
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const value = board[row][col];

        if (value === 0) {
          continue;
        }

        const effect = effects.get(cellKey(row, col));
        let scale = 1;

        if (effect) {
          const progress = (now - effect.start) / POP_MS;

          scale =
            effect.kind === 'spawn'
              ? popScale(progress, 0, 1.1)
              : popScale(progress, 1, 1.12);
        }

        this.drawTile(cellRect(metrics, row, col), value, scale);
      }
    }
  }

  expireEffects(now) {
    for (const [key, effect] of this.effects) {
      if (now - effect.start >= POP_MS) {
        this.effects.delete(key);
      }
    }
  }

  drawBackground(metrics) {
    const { ctx } = this;

    ctx.fillStyle = BOARD_COLOR;
    roundRect(ctx, metrics.padding, metrics.padding, metrics.board, metrics.board, metrics.cell * 0.09);
    ctx.fill();

    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        this.drawTile(cellRect(metrics, row, col), 0);
      }
    }
  }

  drawBoard(metrics, board) {
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const value = board[row][col];

        if (value !== 0) {
          this.drawTile(cellRect(metrics, row, col), value);
        }
      }
    }
  }

  drawTile(rect, value, scale = 1) {
    const { ctx } = this;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    const width = rect.w * scale;
    const height = rect.h * scale;
    const x = centerX - width / 2;
    const y = centerY - height / 2;
    const radius = rect.w * 0.09;

    if (value === 0) {
      ctx.fillStyle = EMPTY_COLOR;
      roundRect(ctx, x, y, width, height, radius);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(31, 24, 16, 0.22)';
    ctx.shadowBlur = rect.w * 0.06;
    ctx.shadowOffsetY = rect.w * 0.012;
    ctx.fillStyle = tileColor(value);
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = tileTextColor(value);
    ctx.font = `700 ${fontSizeFor(value, rect.w)}px "Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), centerX, centerY + rect.h * 0.015);
  }
}

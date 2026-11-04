export const SESSION_KEY = 'canvas2048.session.v1';
export const BEST_KEY = 'canvas2048.best.v1';

const VALID_STATUSES = ['playing', 'won', 'over'];

function isPowerOfTwo(value) {
  return value >= 2 && (value & (value - 1)) === 0;
}

export function isValidBoard(board) {
  if (!Array.isArray(board) || board.length === 0) {
    return false;
  }

  const size = board.length;

  return board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === size &&
      row.every((value) => value === 0 || (Number.isInteger(value) && isPowerOfTwo(value)))
  );
}

export function isValidSession(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  if (!isValidBoard(snapshot.board)) {
    return false;
  }

  if (!Number.isInteger(snapshot.score) || snapshot.score < 0) {
    return false;
  }

  if (!VALID_STATUSES.includes(snapshot.status)) {
    return false;
  }

  if (snapshot.size !== undefined && snapshot.size !== snapshot.board.length) {
    return false;
  }

  return true;
}

function defaultBackend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createStorage(backend = defaultBackend()) {
  function read(key) {
    try {
      return backend ? backend.getItem(key) : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      if (!backend) {
        return false;
      }

      backend.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      backend?.removeItem(key);
    } catch {
      return false;
    }

    return true;
  }

  return {
    loadSession() {
      const raw = read(SESSION_KEY);

      if (!raw) {
        return null;
      }

      try {
        const snapshot = JSON.parse(raw);
        return isValidSession(snapshot) ? snapshot : null;
      } catch {
        return null;
      }
    },

    saveSession(snapshot) {
      if (!isValidSession(snapshot)) {
        return false;
      }

      return write(SESSION_KEY, JSON.stringify(snapshot));
    },

    loadBest() {
      const raw = read(BEST_KEY);
      const score = Number.parseInt(raw ?? '', 10);

      return Number.isFinite(score) && score >= 0 ? score : 0;
    },

    saveBest(score) {
      if (!Number.isFinite(score) || score < 0) {
        return false;
      }

      return write(BEST_KEY, String(Math.floor(score)));
    },

    clear() {
      remove(SESSION_KEY);
      remove(BEST_KEY);
    }
  };
}

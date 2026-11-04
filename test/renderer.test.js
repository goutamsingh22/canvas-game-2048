import { describe, expect, it } from 'vitest';
import {
  Renderer,
  cellRect,
  easeOutCubic,
  fontSizeFor,
  getMetrics,
  lerp,
  popScale,
  tileColor,
  tileTextColor
} from '../src/renderer.js';

describe('tile styling', () => {
  it('maps classic values to palette colours', () => {
    expect(tileColor(2)).toBe('#eee4da');
    expect(tileColor(2048)).toBe('#edc22e');
  });

  it('falls back to a super-tile colour', () => {
    expect(tileColor(4096)).toBe('#3c3a32');
  });

  it('uses dark text only on light tiles', () => {
    expect(tileTextColor(2)).toBe('#776e65');
    expect(tileTextColor(4)).toBe('#776e65');
    expect(tileTextColor(8)).toBe('#f9f6f2');
  });

  it('shrinks the font as the value grows', () => {
    expect(fontSizeFor(2, 100)).toBeGreaterThan(fontSizeFor(512, 100));
    expect(fontSizeFor(512, 100)).toBeGreaterThan(fontSizeFor(16384, 100));
  });
});

describe('layout maths', () => {
  it('fits the grid exactly inside the padded board', () => {
    const metrics = getMetrics(4, 480);
    const first = cellRect(metrics, 0, 0);
    const last = cellRect(metrics, 3, 3);

    expect(first.x).toBeCloseTo(metrics.padding);
    expect(first.y).toBeCloseTo(metrics.padding);
    expect(last.x + last.w).toBeCloseTo(480 - metrics.padding);
    expect(last.y + last.h).toBeCloseTo(480 - metrics.padding);
  });

  it('positions cells using the gap between them', () => {
    const metrics = getMetrics(4, 480);
    const first = cellRect(metrics, 1, 2);

    expect(first.x).toBeCloseTo(metrics.padding + 2 * (metrics.cell + metrics.gap));
    expect(first.y).toBeCloseTo(metrics.padding + 1 * (metrics.cell + metrics.gap));
  });
});

describe('animation maths', () => {
  it('eases from zero to one', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps easing outside the unit interval', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });

  it('pops spawns from zero and settles at one', () => {
    expect(popScale(0, 0, 1.1)).toBe(0);
    expect(popScale(0.6, 0, 1.1)).toBeCloseTo(1.1);
    expect(popScale(1, 0, 1.1)).toBe(1);
  });

  it('pops merges starting at full size', () => {
    expect(popScale(0, 1, 1.12)).toBe(1);
    expect(popScale(0.6, 1, 1.12)).toBeCloseTo(1.12);
    expect(popScale(1, 1, 1.12)).toBe(1);
  });

  it('interpolates between positions', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe('Renderer', () => {
  it('requires a canvas element', () => {
    expect(() => new Renderer(null)).toThrow(/canvas/i);
  });

  it('creates a renderer for a canvas', () => {
    const canvas = { getContext: () => ({}) };
    const renderer = new Renderer(canvas, { size: 4 });

    expect(renderer.size).toBe(4);
    expect(renderer.board).toBeNull();
  });
});

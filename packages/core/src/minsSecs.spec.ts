import { describe, it, expect } from 'vitest';
import minsSecs from './minsSecs.js';

describe('minsSecs', () => {
  it('formats zero seconds', () => {
    expect(minsSecs(0)).toBe('0:00');
  });

  it('formats seconds less than a minute', () => {
    expect(minsSecs(5)).toBe('0:05');
    expect(minsSecs(30)).toBe('0:30');
    expect(minsSecs(59)).toBe('0:59');
  });

  it('formats exact minutes', () => {
    expect(minsSecs(60)).toBe('1:00');
    expect(minsSecs(120)).toBe('2:00');
  });

  it('formats minutes and seconds', () => {
    expect(minsSecs(65)).toBe('1:05');
    expect(minsSecs(90)).toBe('1:30');
    expect(minsSecs(125)).toBe('2:05');
  });

  it('pads single-digit seconds with leading zero', () => {
    expect(minsSecs(61)).toBe('1:01');
    expect(minsSecs(9)).toBe('0:09');
  });

  it('floors fractional seconds', () => {
    expect(minsSecs(5.7)).toBe('0:05');
    expect(minsSecs(61.9)).toBe('1:01');
  });

  it('handles large values', () => {
    expect(minsSecs(3600)).toBe('60:00');
    expect(minsSecs(3661)).toBe('61:01');
  });
});

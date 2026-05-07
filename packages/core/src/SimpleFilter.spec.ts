import { describe, it, expect, vi } from 'vitest';
import SimpleFilter from './SimpleFilter.js';
import SoundTouch from './SoundTouch.js';

function createMockSource(length = 44100) {
  return {
    extract: vi.fn(
      (target: Float32Array, numFrames: number, _position: number) => {
        for (let i = 0; i < numFrames * 2; i++) {
          target[i] = Math.sin(i * 0.01);
        }
        return Math.min(numFrames, length - _position);
      },
    ),
  };
}

describe('SimpleFilter', () => {
  describe('constructor', () => {
    it('creates with a source and pipe', () => {
      const source = createMockSource();
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      expect(filter.sourcePosition).toBe(0);
      expect(filter.position).toBe(0);
    });
  });

  describe('sourcePosition', () => {
    it('resets filter state when set', () => {
      const source = createMockSource();
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      filter.sourcePosition = 1000;
      expect(filter.sourcePosition).toBe(1000);
    });
  });

  describe('position setter', () => {
    it('throws when new position is greater than current', () => {
      const source = createMockSource();
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      expect(() => {
        filter.position = 100;
      }).toThrow('New position may not be greater than current position');
    });

    it('rewinds within the history buffer', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const output = new Float32Array(400);

      const extracted = filter.extract(output, 100);
      expect(extracted).toBeGreaterThan(0);

      filter.position = 50;

      expect(filter.position).toBe(50);
    });

    it('throws when rewinding outside the history buffer', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const output = new Float32Array(400);

      filter.extract(output, 100);

      expect(() => {
        filter.position = -1;
      }).toThrow('New position falls outside of history buffer');
    });
  });

  describe('fillInputBuffer', () => {
    it('reads from source and fills the pipe input buffer', () => {
      const source = createMockSource();
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      filter.fillInputBuffer(100);
      expect(source.extract).toHaveBeenCalled();
      expect(filter.inputBuffer!.frameCount).toBeGreaterThan(0);
    });

    it('grows the scratch buffer when a larger request arrives', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });

      filter.fillInputBuffer(8);
      filter.clear();
      filter.fillInputBuffer(256);

      expect(source.extract).toHaveBeenLastCalledWith(
        expect.any(Float32Array),
        256,
        8,
      );
    });
  });

  describe('extract', () => {
    it('produces output samples', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const output = new Float32Array(200);
      const extracted = filter.extract(output, 100);
      expect(extracted).toBeGreaterThan(0);
      expect(filter.position).toBe(extracted);
    });

    it('returns zero when zero frames are requested', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const output = new Float32Array(200);

      expect(filter.extract(output, 0)).toBe(0);
      expect(filter.position).toBe(0);
    });
  });

  describe('onEnd callback', () => {
    it('calls the callback when invoked', () => {
      const source = createMockSource();
      const pipe = new SoundTouch({});
      const callback = vi.fn();
      const filter = new SimpleFilter({ sourceSound: source, pipe, callback });
      filter.onEnd();
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('handleSampleData', () => {
    it('extracts 4096 frames into event data', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const event = { data: new Float32Array(4096 * 2) };
      filter.handleSampleData(event);
      expect(filter.position).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('resets output buffer position', () => {
      const source = createMockSource(100000);
      const pipe = new SoundTouch({});
      const filter = new SimpleFilter({ sourceSound: source, pipe });
      const output = new Float32Array(200);
      filter.extract(output, 100);
      filter.clear();
      expect(filter.outputBuffer!.frameCount).toBe(0);
    });
  });
});

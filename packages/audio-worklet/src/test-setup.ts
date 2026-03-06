import { vi } from 'vitest';

class MockAudioWorkletNode {
  parameters = new Map();
  constructor(_context: unknown, _name: string, _options?: unknown) {}
}

vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);

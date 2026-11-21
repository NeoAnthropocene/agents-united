import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Pins the setup file tests/setup/yield-to-runner.ts (see it for the reason) by what it does,
// not by reading its text: it makes the worker's event loop turn between two tests.

describe('the setup file yields to the runner between tests', () => {
  let ranBetweenCases = false;

  it('case 1 schedules a callback for the next turn of the loop and does not wait for it', () => {
    setImmediate(() => {
      ranBetweenCases = true;
    });
    expect(ranBetweenCases).toBe(false);
  });

  it('case 2 sees the callback has run, which is only so if the hook yielded between the cases', () => {
    expect(ranBetweenCases).toBe(true);
  });
});

describe('the setup file still yields while a file uses fake timers', () => {
  // vi.useFakeTimers() replaces the global setImmediate. A hook that awaited the replaced
  // function would never resume, so the hook must have kept the real one.
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('case 1 runs under fake timers', () => {
    expect(vi.isFakeTimers()).toBe(true);
  });

  it('case 2 runs under fake timers and was not held up by the hook', () => {
    expect(vi.isFakeTimers()).toBe(true);
  });
});

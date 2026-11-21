import { beforeEach } from 'vitest';

// Why this file exists
//
// Vitest 3 runs each test file in a worker that reports progress to the main
// process and waits for a reply. The worker gives each report a fixed 60
// seconds and no setting changes that. A reply is only read when the worker's
// event loop gets a turn. Tests that run one right after another without
// awaiting anything (for example 1,000+ cases that each run a child process
// with a synchronous spawn) never give it a turn, so after 60 seconds in a row
// the run ends with `[vitest-worker]: Timeout calling "onTaskUpdate"` even
// though every test passed.
//
// Awaiting one `setImmediate` before each test lets the loop turn once between
// tests, at the cost of one empty turn per test.
//
// What it does not do: it does not help inside one long synchronous test or a
// long synchronous `beforeAll`, and not between tests that run concurrently
// (`.concurrent`). A test that relied on no turn of the loop between two cases
// would now see one.
//
// Upstream: vitest-dev/vitest#8164 (the report), #8297 (the fix, which removes
// the limit and ships in vitest 4), #11082 (the limit is not configurable in 3.x).
// When the repository moves to vitest 4, this file can go.

// Kept at load time: vi.useFakeTimers() replaces the global setImmediate (and the one on
// node:timers) for the tests that use it, and a hook awaiting the fake would never resume.
const realSetImmediate: typeof setImmediate = globalThis.setImmediate;

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    realSetImmediate(resolve);
  });
});

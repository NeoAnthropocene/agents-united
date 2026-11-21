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
// Awaiting one `setImmediate` before each test lets the loop turn once per
// test, so no stretch is longer than one test. The cost is one empty turn of the
// loop per test, and no test changes.
//
// Upstream: vitest-dev/vitest#8164 (the report), #8297 (the fix, which removes
// the limit and ships in vitest 4), #11082 (the limit is not configurable in 3.x).
// When the repository moves to vitest 4, this file can go.
beforeEach(async () => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
});

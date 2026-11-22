import { REQUESTS_END, REQUESTS_START, renderRequests } from '../../src/core/native-requests.js';

/** The generated requests block (ADR 0076) of a specialist fixture that holds `tools`, as a native role must carry it. */
export const requestsFixture = (tools: readonly string[]): string => `${REQUESTS_START}\n${renderRequests('specialist', tools)}\n${REQUESTS_END}`;

# 1. CLI Distribution and Runtime Architecture

We will build the CLI using TypeScript (Node.js ESM binary) packaged and distributed to npm under `agents-united` (executable via `npx agents-united` or global `npm i -g agents-united`), using a modern CLI framework (e.g. Commander / CAC + Clack/Inquirer for rich interactive UI) and Vitest for unit/integration testing under TDD.

This allows zero-install execution (`npx agents-united add <bundle>`), platform portability across Windows/macOS/Linux, and high discoverability.

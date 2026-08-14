# Persistent Rule: Clean Code & Modular Architecture

## Purpose & Scope
This rule establishes rigorous standards for code organization, type safety, dependency boundaries, and maintainability across the Agents United ecosystem.

---

## 1. Strict TypeScript & Type Safety
- **No Implicit `any`**: All function parameters, return values, and exported interfaces must have explicit type declarations.
- **Centralized Types**: Define and export all shared data models in `src/core/types.ts`.
- **Exhaustive Pattern Matching**: Use TypeScript discriminated unions for polymorphic types (e.g. `InstallScope`, `InstallMethod`, `AgentHost`).

---

## 2. Modular Architecture & Clean Seams
- **Single Responsibility Principle**: Keep classes and modules focused on a single domain (e.g. `RegistryResolver` manages assets, `InstallEngine` coordinates installation, `FileAdapter` handles host-specific file writes).
- **Decoupled Interfaces**: Business logic must never directly invoke terminal I/O (`console.log`, `@clack/prompts`). All user interaction belongs in `src/cli.ts`.
- **Recursive Bundle Composition**: Support parent-child bundle inheritance (`parentBundle: "software-engineering"`) to eliminate duplicate asset declarations.

---

## 3. Idempotency & Reversibility
- **Safe State Tracking**: Every installed asset must be recorded in `agents-united.json` with its content hash and installation mode (`symlink` vs `copy`).
- **Clean Uninstallations**: Uninstallation routines must remove only tracked, managed assets without damaging user-created workspace files.
- **Zero Orphaned Files**: Installation failures must roll back cleanly or report exact error diagnostic paths.

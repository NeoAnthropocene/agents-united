# ADR 0062: Self-contained optional agency 3D Bundle

- **Status**: Accepted (placement and initial contract; implementation pending)
- **Date**: 2026-11-04
- **Context**: [Plan 045](../../plans/045-agency-3d-designer.md), [Phase A fixture](../../tests/agency-3d-placement.test.ts).

## Context

A 3D specialist needs its own Skills and helper resources. The agency Bundle cannot declare a specialist without shipping its declared Skills, and parent Bundle resolution inherits assets but not the parent's native role mappings or persona aliases. The installer does not enforce an agency prerequisite. Requiring the agency implicitly would therefore allow a misleading partial installation; a child also needs duplicated direct declarations to map parent native roles.

## Decision

Use a self-contained optional `agency-3d-production` Bundle with no `parentBundle`: include Arda's canonical and Claude-native role, all four initial production Skills and every helper they require, including shared helpers declared as Bundle assets. It must support a complete direct brief without Chris. When the agency is installed, Chris owns agency routing and delegates to Arda only when that role is installed; when absent, he recommends the optional Bundle. The 3D Bundle does not require the agency as an implicit prerequisite. Do not add a core dependency engine for this choice.

The first implementation targets supplied or locally procedural glTF 2.0 GLB, one project-local Three.js browser viewer, and a PNG proof with provenance, explicit rights and bounded validation. Missing runtime or unsupported input must produce a clear prerequisite or unsupported/unverified outcome; no fabricated render. Motion handoff is a later acceptance step, and Blender, AR, provider adapters and paid generation remain deferred. This is an implementation contract, not a claim that any runtime or artifact works today.

Claude-native workspace installation is the initial supported surface. Declare `subagent-3d-designer.md` to native `agency-3d-designer`; `arda-3d` may be stored as a Bundle persona alias, but Claude alias invocation is **unverified** and must not be promised from metadata alone. Future implementation must update and verify Chris's native roster and authored `Agent(...)` allowlist, native guard/floor/contracts, direct role Skill bindings and any `full` exclusion. The roster generator alone does not update the native allowlist.

## Evidence and consequences

A synthetic role installed standalone before the agency with four synthetic Skills, their helper files and a shared Skill. The fixture then installed a deliberately updated native Chris whose roster names the supplying Bundle and whose authored allowlist contains the fixture role; both installed role files remained present. A separate fixture shows shared Skill ownership and agency role preservation on removal, and edited Skill update/uninstall protection. These test metadata, file placement and lifecycle samples, not Claude discovering or invoking a role, usefulness of a real 3D brief, or actual GLB/viewer/PNG production. The fixture explicitly updates Chris's source; installation does not dynamically rewrite his native allowlist from Bundle metadata.

This layout avoids inherited agency projection collisions and permits direct use, but repeats shared dependencies and requires explicit coordinator integration and co-ownership tests. Phase B must build the real native package and rerun relevant contract and lifecycle gates. Phase C/D must prove local output, prerequisites, source ownership and installed lifecycle. Phase E requires the maintainer-run native pilot and human review. All remain **unverified** until actually performed.

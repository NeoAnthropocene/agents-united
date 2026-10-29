# Optional Remotion Studio collaboration

Agent-only production is the default. Chris asks once, before composition work starts, whether the user wants:

1. **Agent-only** — the specialist authors, proofs and renders; the user reviews the MP4 and evidence.
2. **Hands-on Studio** — the user wants to inspect or change the video while the specialist works.

Studio never becomes a dependency of the final pipeline. A hands-on choice adds human preview and editing; it must not replace the agentic build, the canonical proof gate or the final measured export.

## Starting Studio

Complete licence preflight and scaffold first. If the official add-on is installed, use its `remotion-studio` skill; otherwise the project-local CLI is enough:

```text
cd media/remotion
npm run studio -- --no-open
# equivalent, with the explicit entrypoint this scaffold uses:
npx remotion studio index.jsx --no-open
```

The explicit `index.jsx` is required: this scaffold has no `src/index.ts`, and the CLI otherwise
reports “No Remotion entrypoint was found.” Open the printed URL (default port 3000, higher if
occupied). Do not install a second Remotion version or a global CLI; use the pinned project
dependency and retain the lockfile.

## Working with user edits

- Treat user edits in Studio as source changes. Read the changed JSX/props, preserve intentional edits and rerun the approved proof plan before the next full render.
- Keep generated timeline, fingerprint and audio routing helper-owned. Copy or timing changes require the normal revision/fingerprint path through Chris and Sound.
- Studio's own render UI may be used for a quick preview, but the deliverable must pass this Skill's helper render and encoded review unless the user explicitly accepts another export as a separate, unverified artifact.
- Close Studio when the session ends; do not leave a long-running server or a browser profile in the public asset tree.
- If preview is unavailable, continue agent-only and report the limitation. Do not delay production waiting for a UI choice the user did not ask for.

## Security and access

Studio binds a local development server and may expose project source and assets through that port. Use loopback/local access, do not expose it publicly, keep credentials out of props/assets and follow the host's permission model. Interactive Studio behaviour is not covered by the offline render proof.

# Project-local runtime and resource boundary

Read this for setup, missing packages or a missing browser. This reference does not
authorize installation, account connections or provider spending.

## Resolve both Skill roots

Use Node 24+ and an absolute project root. `scripts/project.mjs` imports
`../../audiovisual-review/scripts/review.mjs`; preserve that sibling relationship and
the companion's required resources. The shared project/media references are linked from
[preflight](preflight.md). Do not copy a weaker validator into this Skill or download a
replacement because a companion is missing.

The own-resource pack contains Remotion files only. It is not a standalone host install.
Verify bundle ownership, host loading and required bindings against the actual installed
resource set before calling the workflow runnable. Name any missing integration prerequisite.
Other hosts' execution remains unverified until separately demonstrated.

## Exact dependencies and setup

Scaffold writes a private package in `media/remotion/package.json` with these exact pins:

| Package | Version |
| --- | --- |
| `remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli` | `4.0.538` each |
| `react`, `react-dom` | `19.0.0` each |

After project setup is authorized, install within `media/remotion/` using the chosen
package manager and retain the lockfile. Use `npm ci` for a compatible existing lockfile.
The helper never installs, resolves from an ancestor dependency tree or downloads a
browser. It checks direct installed package metadata and resolved entries against the pins.
Do not install globally or change the selected project's root dependencies to satisfy it.

Pass an approved existing absolute Chrome-compatible executable with `--browser`.
Keep runtime binaries, caches and browser profiles outside the public assets and source
archive. The accepted Windows proof used Chrome `155.0.8059.86`; that is a recorded test
version, not proof that any browser/build/OS combination works. No runtime binaries ship
in this Skill. Retain applicable package/browser/encoder licence records separately.

## Commands and writes

Run from any working directory with the resolved absolute Skill root:

```text
node "<skill-root>/scripts/project.mjs" preflight --project "<project>" --purpose evaluation
node "<skill-root>/scripts/project.mjs" scaffold --project "<project>" --purpose evaluation
node "<skill-root>/scripts/project.mjs" refresh --project "<project>" --purpose evaluation --approved-revision "<current-revision>"
node "<skill-root>/scripts/project.mjs" render --project "<project>" --purpose evaluation --browser "<browser>" --output "media/remotion/out-r2"
```

Append `--audio-manifest "audio/manifest.json"` consistently when supplying an approved
mix. This is relative to the project root, including when the manifest is nested.
Choose `--purpose production` only with the actual owner/representative's production
record and scope. Unknown, duplicate and incomplete flags fail. Exit 0 means the command's
contract passed; exit 2 means rejected. Save the actual process exit before displaying logs.

`preflight` performs no writes. `scaffold` exclusively creates `media/remotion/`, copies
the four original templates, writes props/package/provenance and copies an optional master
to `public/audio/master.wav`. It refuses existing files, links and directories there.
`refresh` has the narrower owned-data writes described in [revisions](revisions.md).
`render` reserves a new output directory (default `media/remotion/out`), bundles source,
uses the explicit browser, checks actual `AgencyMotion` metadata and writes MP4/stills
and evidence. Its parent directory must already exist within the project. Failures retain
partial artifacts; do not erase a prior attempt to reuse its name.

## Source disposition and consulted material

The Skill, helper and templates are original agents-united work under the accompanying
MIT licence, copyright 2026 NeoAnthropocene. No upstream Skill or animation template was
copied or vendored; original metadata has no invented `source` or `adaptedFrom`.
The Remotion API and licence references already reviewed for the pinned `4.0.538` runtime
are listed in [preflight](preflight.md). They informed the integration; this source MIT
licence does not grant Remotion production entitlement or relicense runtime dependencies.
The reviewed versioned licence links v4 terms; prospective v5 documentation is not the
licence basis for this pin. Review again before changing versions or actual production use.

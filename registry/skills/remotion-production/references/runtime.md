# Project-local runtime and resource boundary

Read this for setup, missing packages or a missing browser. Selecting Remotion
authorizes necessary project-local setup within the recorded scope. Account connections,
provider spending and machine-wide changes need their own authorization.

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

Scaffold writes a private package in `media/remotion/package.json` using the exact supported
version in the project's reviewed `media/remotion-license.json`. New projects select the
current reviewed release `4.0.541` after a fresh registry check. Existing `4.0.539` and
`4.0.540` projects retain their matching licence record, dependencies and lockfile; all three are supported.
The defaults for a newly reviewed project are:

| Package | Version |
| --- | --- |
| `remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli` | `4.0.541` each |
| `react`, `react-dom` | `19.0.0` each |

Within the selected Remotion setup scope, install within `media/remotion/` using the chosen
package manager and retain the lockfile. Use `npm ci` for a compatible existing lockfile.
The helper never installs, resolves from an ancestor dependency tree or downloads a
browser. It checks direct installed package metadata and resolved entries against the
project's reviewed exact version, including optional `@remotion/*` packages in
`dependencies` or `devDependencies`. Refresh and render reject changes to the reviewed
licence or package declaration during their asynchronous setup before committing a handoff
or starting encoding.
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
copied or vendored into this Skill; original metadata has no invented `source` or
`adaptedFrom`. Official Remotion Skills are obtained directly from upstream or a compatible plugin;
Agents United does not redistribute their contents. See [official Skills](official-agent-skills.md).
The Remotion API and licence references reviewed for the original `4.0.539` runtime
are listed in [preflight](preflight.md). The tagged `4.0.540`
[licence](https://github.com/remotion-dev/remotion/blob/v4.0.540/LICENSE.md) was compared
with `4.0.539` on 2026-11-04 and is identical. The tagged `4.0.541`
[licence](https://github.com/remotion-dev/remotion/blob/v4.0.541/LICENSE.md) was compared
with `4.0.540` on 2026-11-05 and is identical. The saved 4.0.541 host record includes
successful renders with a project-local helper patch; the current preview and installed
helper workflow at this version remains unverified in a real render.
These sources informed the integration; this source MIT
licence does not grant Remotion production entitlement or relicense runtime dependencies.
The reviewed versioned licence links v4 terms; prospective v5 documentation is not the
licence basis for this pin. Review again before changing versions or actual production use.

## Rendering mode

The helper renders through `@remotion/bundler` + `@remotion/renderer` (CLI/server-side), which takes
a real screenshot and therefore honours every CSS effect the proof frames were reviewed with.
Client-side rendering (`@remotion/web-renderer`) has no render quota either and is worth it for a
hands-on Studio render or a browser-only host, but it emulates layout onto a canvas and does not
support `z-index`, `backdrop-filter`, `perspective` or non-linear-gradient backgrounds. It is not in
these pins; see [rendering modes](rendering-modes.md) before proposing it.

## Release drift
The newest reviewed default is `REMOTION_VERSION` in [project.mjs](../scripts/project.mjs);
`SUPPORTED_REMOTION_VERSIONS` also retains previously reviewed project versions.
Before a version change or a release review, check all four packages in the public registry:

```text
node "${CLAUDE_SKILL_DIR}/scripts/check-release.mjs"
npm run skills:remotion-release        # same check from this repository's root
```

Exit 0 means the pinned version equals `latest` for `remotion`, `@remotion/bundler`,
`@remotion/renderer` and `@remotion/cli`. Exit 1 reports a version mismatch; exit 2 records a
registry/network lookup failure. This checker only reads public package metadata, bounds
each lookup to 10 seconds and rejects malformed or non-stable versions. A newer unreviewed
release is a review task; do not silently claim an older release is latest. A version
change still requires reviewing the matching `LICENSE.md`, release notes, installed browser
and the official skills snapshot, then updating the pin, licence example, docs and tests in
one reviewed change. Resolve latest only during selected setup/review, then retain the exact
project version and lockfile. Never update an existing project automatically during scaffold,
refresh or render. Add only dependencies required by the selected composition or Element.

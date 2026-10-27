# Remotion project preflight and scaffold

The helper supports `preflight`, `scaffold`, `refresh` and `render`. This reference
covers initial input/licence checks and scaffold; use [runtime](runtime.md),
[revisions](revisions.md) and [export review](review.md) for later steps. `allowed: true`
means the applicable record contracts passed. `entitlementVerified` and
`productionAuthorized` remain `false`; the helper cannot verify live entitlement.
Rendering has a bounded internal test proof, while human creative review and production
entitlement remain unverified. The helper never installs dependencies.

## Project inputs and commands

Use Node 24 or later. The selected absolute project folder must already contain
`media/project.json` and `media/timeline.json` using the complete shared
[project contract](../../workflow-agency-motion-production/references/project-contract.md)
and [media contract](../../audiovisual-review/references/media-contract.md).
Preferences must select `remotion`; timeline fps/width/height must equal output preferences.
The helper imports the shared validators rather than maintaining another media schema.

From this Skill's root, replacing the example path with the selected project:

```powershell
node scripts/project.mjs preflight --project 'C:\work\motion-project' --purpose evaluation
node scripts/project.mjs scaffold --project 'C:\work\motion-project' --purpose evaluation
node scripts/project.mjs scaffold --project 'C:\work\motion-project' --purpose production --audio-manifest 'audio/manifest.json'
```

Both commands accept exactly `--project`, optional `--purpose evaluation|production`
(default `evaluation`), and optional `--audio-manifest` (project-relative JSON path).
`preflight` performs no writes. `scaffold` creates `media/remotion` exclusively and
refuses an existing file, directory or link there. Unknown/duplicate/incomplete flags
fail. CLI output is a JSON report; exit 0 means accepted, exit 2 means rejected.
Neither command installs, renders, opens a host, reads `.env`, or contacts a provider.

If timeline cues exist, the audio manifest is required. Its revision, fingerprint,
timebase, loudness report, cues and referenced local files must pass the shared checks.
Only its master is copied into `media/remotion/public/audio/master.wav`; the composition
plays the full master once from frame zero, preserving its existing mixing relationships.
All input paths must remain inside the selected project, including resolved junctions.
These checks do not decode audio or establish that measurements are truthful.

## Separate evaluation or owner eligibility record

Place the nonsecret record at `media/remotion-license.json`. Keep it separate from the
strict shared project-preferences schema. The provided
[unreviewed starter](../assets/license-review.example.json) deliberately fails; copying
it does not establish eligibility. Production eligibility requires actual project-owner
or authorized-representative facts. An agent may truthfully record its own isolated
internal, noncommercial suitability evaluation under the pinned license's evaluation
permission; this does not require an added human approval. Test-only fictional owner
records are never project review evidence.

| Field | Required meaning |
| --- | --- |
| `schemaVersion` | Exactly `1`. |
| `remotionVersion` | Exactly `4.0.538`; review again when changing packages. |
| `status` | `evaluation`, `free-license`, or `company-license`; agents may select only `evaluation`, owners/representatives supply production eligibility facts. |
| `purpose` | `evaluation` or `production`, the scope actually reviewed. |
| `reviewedOn` | Actual review date, a valid `YYYY-MM-DD`. |
| `reviewedBy` | Actual reviewer name, including the agent identity for automated evaluation; never impersonate a person. |
| `reviewerRole` | `project-owner`, `authorized-representative`, or `automated-evaluation`. |
| `entity` | Actual legal entity/project owner for owner reviews; the actual internal test project/subject for automated evaluation, without asserting owner facts. |
| `basis` | Specific eligibility explanation and applicable use; automated evaluation must describe isolated internal suitability tests without commercial use. |
| `evidence` | Nonsecret supporting reference: pinned evaluation clause and test scope, owner-reviewed eligibility note, or company entitlement reference. Never store a license key, token or credential here. |
| `commercialUse` | Explicit boolean; must be `false` for `evaluation`. |
| `licenseUrl` | Exactly `https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md`. |
| `evaluationScope` | Required as `internal-suitability-test` for `automated-evaluation`; optional for owner/representative records. No other value is accepted. |

Unknown fields and missing/invalid required values fail. Evaluation records only pass
evaluation requests; they cannot authorize production. Production requests require a
production review with a `free-license` or `company-license` status from the actual
owner or authorized representative. An `automated-evaluation` reviewer must use
`status: evaluation`, `purpose: evaluation`, `commercialUse: false` and
`evaluationScope: internal-suitability-test`; production requests or commercial/free/
company entitlement claims fail. Record the actual agent in `reviewedBy`, the selected
internal test project in `entity`, its narrow smoke-test scope in `basis`, and the pinned
license's Free License / Eligibility evaluation clause in `evidence`. Do not assert
anyone's headcount, human review or paid entitlement.

The helper checks
the declaration's completeness and scope; it does not check a purchase, reviewer identity,
headcount, entitlement validity or whether the owner's legal interpretation is correct.
No automatic acceptance is inferred from the presence of a license field.

## Version and source review, 2026-10-24

The [versioned 4.0.538 license](https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md)
allows free use for individuals, for-profit organizations with up to three employees,
nonprofits, and noncommercial suitability evaluation. Other entities require a Company
License. Agency production work is not automatically free. The owner must assess the actual entity,
engagement and intended use. Evaluation is distinct from production/commercial eligibility.

The linked [v4 terms](https://www.remotion.pro/terms-4-0) identify themselves as replaced
when 5.0 launches; the [v5 terms](https://www.remotion.dev/docs/terms) state their future
effective scope. This scaffold pins 4.0.538. Recheck terms before any later real use.
The evaluation clause does not require a human reviewer. Applying it to the authorized
isolated internal smoke tests is a scoped interpretation, not a production-entitlement
claim. Actual owner eligibility and live licensing entitlement remain **unverified**.

Public npm publisher metadata confirmed exact `4.0.538` availability for
[`remotion`](https://registry.npmjs.org/remotion/4.0.538),
[`@remotion/bundler`](https://registry.npmjs.org/@remotion/bundler/4.0.538),
[`@remotion/renderer`](https://registry.npmjs.org/@remotion/renderer/4.0.538), and
[`@remotion/cli`](https://registry.npmjs.org/@remotion/cli/4.0.538). All four use exact
matching pins as required by the
[version guidance](https://www.remotion.dev/docs/version-mismatch). React and React DOM
are both pinned to `19.0.0`, within their declared `>=16.8.0` peer ranges. Packages are
declared only in `media/remotion/package.json`; this step does not install them or
change the selected project's root dependencies.

The scripts and React source here are original Agents United work. Consulted API
references: [registerRoot](https://www.remotion.dev/docs/register-root),
[Composition](https://www.remotion.dev/docs/composition),
[useCurrentFrame](https://www.remotion.dev/docs/use-current-frame), and
[Html5Audio/staticFile](https://www.remotion.dev/docs/html5-audio). No upstream Skill text
or source was vendored. `input-props.json` holds reusable timeline, scene copy, theme and
optional master-audio parameters. Sequence durations use the shared half-open frame ranges;
animation derives from each sequence's local frame, without wall clocks or CSS animation.

The starter has no remote images or custom fonts; system font appearance can vary by OS.
For later images use [Img](https://www.remotion.dev/docs/img) to wait for readiness, and
explicitly gate any added asynchronous font/media loading. The bounded actual bundle,
browser/export and revision proofs and their limits are recorded in [export review](review.md);
new async assets, full playback/listening and other-host execution remain unverified.
Rerun shared preflight against current inputs before rendering; the generated props are a
snapshot, and editing them does not perform contract or license validation.

For an approved handoff change, use the explicit source-preserving
[revision workflow](revisions.md); do not edit generated timeline/provenance fields or
delete customized source to bypass the stale-snapshot check.

# Accept an approved timeline or audio revision

`refresh` updates an existing scaffold's owned handoff data while keeping customized
React source, package files, the lockfile, installed dependencies and previous outputs.
It does not install, render, establish creative approval or grant production eligibility.
Current preferences, selected renderer, purpose/licensing and the shared timeline/audio
contracts still have to pass. Obtain the handoff decision through the project's normal
approval process; `--approved-revision` is the caller's explicit acknowledgment, not
automated proof of a human review.

From this Skill's root, with the selected project already scaffolded:

```powershell
node scripts/project.mjs refresh --project 'C:\work\motion-project' --purpose evaluation --audio-manifest 'audio/manifest-r2.json' --approved-revision r2
node scripts/project.mjs render --project 'C:\work\motion-project' --purpose evaluation --audio-manifest 'audio/manifest-r2.json' --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output 'media/remotion/out-r2'
```

1. Preserve previous canonical input files when replacing them. Save the newly approved
   `media/timeline.json` and matching preferences, and place revised audio/evidence at
   distinct project-relative paths. Measure actual masters; do not invent measurements.
   Its manifest must match the new revision, fingerprint, frame count and timebase.
2. Run `refresh` with the exact current `timeline.revision`. Pass the current audio
   manifest explicitly; omit it only for an approved silent timeline without cues.
   Audio-only changes can use the current revision with the same explicit acknowledgment.
3. Inspect the returned `history` and updated handoff. Existing scene IDs retain their
   copy strings; new IDs receive `Scene <id>` placeholders that need editorial review.
   Removed scene copy is retained in the history. Theme and other custom props survive.
   Review customized JSX when scene IDs or meaning change; refresh cannot judge its intent.
4. Render to a **new** output directory whose parent already exists. Old output
   directories remain exclusive and cannot be replaced. The renderer still checks current
   inputs, generated snapshot and actual composition metadata before encoding.

Only `input-props.json` and `scaffold-provenance.json` are replaced. Their previous bytes
are archived in `media/remotion/handoff-history/<revision>-<unique-id>/`, along with an
explicit acknowledgment record. Revised masters use hash-named files under `public/audio`;
older copied assets stay available. Refresh never rewrites `.jsx`, source modules,
`package.json`, `package-lock.json`, `node_modules`, or prior render/evidence directories.

Missing/wrong acknowledgment, invalid handoffs or purpose, changed package pins, manually
altered owned timeline/provenance/audio routing, changed copied audio, and ambiguous links
are refused. Do not fix these by editing or fabricating provenance. Keep custom audio
routing separate and resolve its ownership before using this generated-master workflow.

If a refresh is interrupted, inspect `.handoff-refresh.lock`, the archived previous JSON
and any staged files before retrying. Retain source, dependencies and previous outputs;
do not blindly remove a lock from an active process. A failed write is not creative or
runtime acceptance. Rendered media and newly added async fonts/media require their own
inspection; full playback/listening and production entitlement remain separate checks.

A scoped source-preserving revision proof used technical synthetic signals. It does not
establish narration/music quality, creative acceptance or actual listening; inspect your
current project output and retain its own command exits and evidence.

# Media Requests and project choices

Original agents-united Media Request and project-preference contract. Chris collects requests during bounded
consultation, resolves questions with the human and records include/defer/decline. A valid
request or saved preference never authorizes production, provider setup or paid calls.

## Media Request v1

Use `assets/media-request.example.json`. Required fields are schemaVersion 1, stable id,
requester, placement, audience, purpose, priority (`required|optional`), assets/copyRefs/
brandRefs (arrays of project-relative references), positive durationSeconds, numeric ratio
(`16:9`), format (`mp4|webm|wav`), accessibility (captions/transcript/reducedMotion booleans),
dependencies (unique IDs), proposedRoute, finite nonnegative costCeilingUsd, nonempty
acceptance criteria and decision (`pending|include|defer|decline`). A request may have empty
asset arrays while consultation discovers gaps; that does not imply production readiness.
proposedRoute has renderer (`native|remotion`, or null for audio-only), audio
(`none|local|api|hybrid`) and an independent generatedFootage boolean. Video requires a
renderer. Reuse approved assets before proposing generation. Static briefs can decline all
media; no helper spawns a role, installs dependencies or connects a provider.

Validate with the sibling audiovisual-review helper:
`node /absolute/path/to/audiovisual-review/scripts/review.mjs request --request /project/media/request.json`.
It checks schema and reference syntax; it does not inspect assets or establish approval.

## Nonsecret `media/project.json`

Required fields: schemaVersion 1, renderer (`native|remotion`), audioRoute
(`local|api|hybrid`), generatedFootage boolean, providers array, output and spend objects.
`providers` holds at most one selected provider per modality:
`{provider,model,modality:'audio'|'video',route:'api'|'mcp'}`. Provider IDs are higgsfield,
kling, elevenlabs, fish-audio, kie and byteplus. Kie/BytePlus are API-only in this contract;
this does not assert a vendor MCP exists. Names/model identifiers are preferences, not
verified capability, availability, auth or billing evidence. Consult the selected
[provider card](../../mcp-setup/references/media-providers.md) before setup.
An empty selection is valid during setup even with API/hybrid audio; production waits
until Chris has selected and verified a callable route. Local audio cannot select an
external audio provider; a video provider requires the separate footage opt-in.

Output declares integer fps, even width/height, videoCodec h264, audioCodec aac,
audioSampleRate 48000, audioChannels 2 and loudness (integratedLufs/toleranceLu/truePeakDbtp).
The default is 1920x1080 at 60 fps, -16 LUFS +/-1 and <=-1 dBTP. For Sound-only delivery, renderer/canvas/video fields remain schema-required unused preferences: they neither require a renderer install nor imply MP4 production. The Media Request uses wav and renderer null. Sound owns any frame/cue timing needed by shared audio validation and hands the reviewed audio directly to Chris. Valid integer rates are
1..240 and dimensions 2..8192. A different codec or fractional-rate delivery needs a
contract extension; do not silently rewrite the spec. `spend` is currency USD, finite
nonnegative ceilingUsd and approval `per-job`. A saved ceiling is not spending consent.

## Safe persistence

`scripts/project.mjs` imports the sibling audiovisual-review validation module; both must
be installed with their source-relative directory relationship. There is no provider or
model dependency. No credential fields, actual `.env` reads/writes, config discovery,
environment dumps or network requests occur. Unknown fields are rejected without values
being printed. Credentials belong in a separately opted-in [private setup flow](../../mcp-setup/references/media-setup.md).

```text
node /absolute/path/to/project.mjs init --project /project --renderer native --audio local --generated-footage no --budget-usd 0
node /absolute/path/to/project.mjs status --project /project
node /absolute/path/to/project.mjs init --project /new-project --preferences /approved/preferences.json
```

The project directory must already exist. `init` validates all values before creating
`media/project.json` exclusively; it never overwrites an existing file, even identical
preferences. `status` validates before returning nonsecret choices and preserves invalid
files. `project.exists` means inspect status and obtain an explicit desired edit; there is
no implicit update or `--force` option. Custom output/providers use the full JSON example
with `--preferences`, which cannot be mixed with individual preference flags. The input
file must be explicitly selected. Links/junctions outside the project are refused.

Stdout is one JSON report with schemaVersion/ok/errors; exit 0 for success, 2 for a named
validation or I/O failure. Successful persistence/status also returns preferences and
`productionAuthorized:false`. Check values on read-back; do not infer callable MCP tools
or provider authorization. On API/hybrid choices Chris uses `mcp-setup` only after opt-in.

Worked example: a campaign specialist proposes a 15-second local UI ad using existing
screenshots. Chris records its request as pending; after the human includes it, native/local
preferences are saved with a zero media API ceiling. Motion still needs approved copy,
assets and timing before production. Anti-pattern: interpreting a saved Remotion choice
as permission to install every media dependency or changing the audio route on a timeout.

Hand-off: give Motion/Sound the request decision, preferences, approved inputs and the
shared `audiovisual-review/references/media-contract.md`; return missing setup or scope
questions to Chris. Follow [production gates](production-gates.md) for installed resources,
sequence, ownership, timing approval and actual delivery review.

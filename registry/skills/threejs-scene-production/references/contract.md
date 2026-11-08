# Independent 3D production contract

Consultation identifies the destination, visual direction, rights, target dimensions, renderer, budgets, accessibility and proof before production. Consultation alone does not authorize deliverable creation. An accepted complete brief can be handled directly without an agency coordinator.

Use the project-local Three.js browser route for supplied or procedural GLB. Record source and dependent asset provenance, local evidence, rights, hashes, transformations and review status. For personal-private work record unknown rights as unverified; known restrictions block prohibited use. Public or commercial delivery requires scoped reviewer attestation and evidence; a hash does not establish legal clearance. Preserve source, existing project files, and user edits. Missing runtime or unsupported input must be reported as a blocker or unverified; do not fabricate a viewer, validation, rendering, viewing or approval.

For a Motion handoff bind the canonical audiovisual timeline fingerprint, scene and half-open frame range, source and asset hashes, renderer, dimensions, outputs and proof. Source or timeline changes invalidate dependent evidence. Sound synchronization and human acceptance need separate evidence. Avoid credentials, uploads, paid services and global installations without specific authorization.

## Supported capture conventions

The initial route produces opaque PNGs against white, with sRGB output and a
full-range RGB encoding. The receipt records these conventions and the actual
perspective camera: field of view, aspect, near/far planes, position, target,
up vector and source-centering offset. The glTF source uses meters and a
right-handed Y-up/Z-forward coordinate system; the viewer centers the default
scene's bounds and rotates a parent pivot around that center. A translated
source must retain the same framing. These fields travel in the Shot Handoff;
missing or unsupported values fail validation.

The output's `alpha:false` describes opaque screenshot composition. The
backend's `contextAlpha` reports a separate WebGL capability and can be true
even for opaque output. Neither field establishes display calibration, target
device appearance or human approval. Old receipts missing the convention or
camera fields must be recaptured into new outputs, not relabelled as current.

Implementation references: the selected installed Three.js 0.180.0 source and
the [WebGLRenderer reference](https://threejs.org/docs/pages/WebGLRenderer.html#outputColorSpace),
and the [glTF 2.0 coordinate and units specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).
These documents were consulted as API/format evidence; the Skill is original
agents-united MIT work, and dependency notices remain with runtime resources.


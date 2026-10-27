# Optional local models: source-based preflight

Official pages inspected 2026-10-24. These are capability leads, not installation instructions or measured quality results. No model is bundled, installed or run by this Skill. Recheck the exact selected release, model card and licence before use; retain the reviewed revision, download hashes and decision in the project record.

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [Stable Audio 3](https://github.com/Stability-AI/stable-audio-3), Small-Music / Small-SFX | The official repository describes separate CPU music and SFX variants and a portable CPU path documented for Windows/macOS/Linux | Exact model/runtime version, available RAM/storage, compatible CPU/runtime, duration/latency and listening test; the two variants are not speech models |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Official model card describes an 82M-parameter TTS model with Apache-licensed weights and multiple supported languages/voices | Exact language/voice coverage and phonemizer/runtime dependencies, pronunciation, hardware/latency and performance approval; do not claim all-language support or general user-voice cloning |

Stable Audio's repository code MIT notice and the model's [Stability AI Community License](https://stability.ai/license) are different evidence. A code licence does not settle model-weight or commercial-use eligibility. Read applicable weight/use terms for the actual organization and intended output, and route unresolved questions through Chris. Kokoro's Apache-licensed weights also do not grant rights to imitate a person or reuse an unrelated source recording.

## Before an optional project-scoped install

1. Chris confirms the missing capability, route, expected iterations and download/install scope. Supplied or recorded audio remains a useful fallback to propose.
2. Inventory the target machine's OS/architecture, RAM and free storage, CPU or approved GPU/driver/runtime; compare against the selected release's actual requirements. Do not promise Windows GPU support from a CPU example.
3. Inspect code and weight licences separately, required notices, model/voice restrictions and client deployment/use constraints. Record the approver and evidence; avoid a blanket legal conclusion from a badge.
4. Confirm exact language/locale, phoneme/pronunciation support and desired voice behavior. A list of languages does not establish acceptable local accent or name pronunciation.
5. Specify a reversible project-local environment and version/download manifest, storage location and cleanup ownership. Review an installer before execution; do not turn a remote bootstrap command into an unreviewed pipe-to-shell action.
6. After an authorized install, record actual versions and inference exit/results. Run one short permitted text/effect test, inspect decoded duration/format, listen and obtain review. A successful install is not a successful model run, and a successful run is not a final performance.

No provider fallback follows a failed dependency, memory or language check. Return the precise failure and a supplied/recorded/local-edit option to Chris. Keep accounts, secrets, private recordings and consent documents out of model logs and public evidence. Pinning a model improves traceability, not determinism across arbitrary runtimes/hardware.

These original notes summarize official capability documentation; no third-party Skill or model asset is vendored. Source inspection is dated evidence and must not be presented as a current benchmark, commercial entitlement or installed availability.

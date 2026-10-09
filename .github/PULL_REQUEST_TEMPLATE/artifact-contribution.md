## Artifact and purpose

<!-- Bundle / agent / skill / workflow / hook; name, user need, related proposal and scope. -->

## Contribution target

- [ ] Base is `dev`; branch starts from fresh `origin/dev`; Conventional Commits used.
- [ ] Checked existing artifacts and open AND closed PRs for prior art and duplication.
- [ ] Reviewed the complete diff and staged diff; no secrets, raw private sessions or managed install outputs.

## Contract, hosts and provenance

<!-- Core/definition, permitted affordances and loading roles; applicable hosts/surfaces/versions;
     binding/delta and enforcement limits. Do not apply one host's frontmatter to every host.
     Source URL + revision/hash + licence for adaptations; credits for independent inspiration.
     Link the required ADR/CONTEXT changes and any proposal that remains unresolved. -->

| Host / surface / observed version | Native paths and bindings / deltas | Offline checks | Live evidence or unverified |
| --- | --- | --- | --- |
| | | | |

- [ ] Core/floor, host conformance and artifact-specific gates apply and are documented.
- [ ] For a subagent, included/reused its shared `.core.md` and companion `.contract.json` as well as the host realization (ADR 0048); otherwise marked N/A with a reason.
- [ ] Every shipped non-reference skill has a loading role; reference-only status is explicit.
- [ ] Provenance/licence/attribution claims match evidence; pending findings have an owner.
- [ ] Guard claims state enforced mechanism versus prose, input visibility and known limits.

## Verification

<!-- Red and green commits for behavior changes; commands, actual exit codes and saved output.
     For live tests: tested commit, host/account/model/session, quota, prompt and cost ledger
     including teammates, sanitized report. Static checks never establish live behavior. -->

- [ ] Required `npm run typecheck && npm test` passed; relevant narrow checks ran first.
- [ ] Build passed; applicable host-library, skill-quality and native checks recorded.

## Review and remaining work

<!-- Concrete reviewer questions, proposed decisions, unverified checks and exact next action.
     Leave inapplicable items marked N/A with a reason; do not claim unavailable checks passed.
     Maintainer review/merge is separate from preparing this PR. -->
